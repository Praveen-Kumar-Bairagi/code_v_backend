const { Op } = require('sequelize');
const { City, CityArea, sequelize } = require('../../../models');
const AppError = require('../../../utils/AppError');
const placesService = require('../../placesService');

function formatArea(row) {
  const plain = row.toJSON ? row.toJSON() : row;
  return {
    id: plain.id,
    cityId: plain.cityId,
    cityName: plain.city?.name ?? undefined,
    name: plain.name,
    latitude: plain.latitude,
    longitude: plain.longitude,
    isActive: plain.isActive,
    sortOrder: plain.sortOrder,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

function parseCoordinate(value, { min, max, label }) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new AppError(`${label} must be between ${min} and ${max}`, 400);
  }
  return n;
}

async function assertCity(cityId) {
  const city = await City.findByPk(cityId);
  if (!city) throw new AppError('City not found', 404);
  return city;
}

async function assertUniqueName(cityId, name, exceptId) {
  const existing = await CityArea.findOne({
    where: {
      cityId,
      [Op.and]: [sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), name.toLowerCase())],
    },
  });
  if (existing && existing.id !== exceptId) {
    throw new AppError('This area already exists in the city', 409);
  }
}

/** Admin list, optionally for one city. Also returns per-city area counts for the city picker. */
async function listAreas(query = {}) {
  const where = {};
  if (query.cityId) where.cityId = String(query.cityId);
  const search = query.search ? String(query.search).trim() : '';
  if (search) where.name = { [Op.iLike]: `%${search}%` };
  if (query.isActive === 'true') where.isActive = true;
  if (query.isActive === 'false') where.isActive = false;

  // Paged only when page/limit is sent; otherwise the full list (dropdowns rely on it).
  const paged = query.page !== undefined || query.limit !== undefined;
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));

  const [result, counts] = await Promise.all([
    CityArea.findAndCountAll({
      where,
      include: [{ model: City, as: 'city', attributes: ['id', 'name'] }],
      order: [
        [{ model: City, as: 'city' }, 'name', 'ASC'],
        ['sortOrder', 'ASC'],
        ['name', 'ASC'],
      ],
      ...(paged ? { limit, offset: (page - 1) * limit } : {}),
    }),
    CityArea.findAll({
      attributes: ['cityId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['cityId'],
      raw: true,
    }),
  ]);
  return {
    items: result.rows.map(formatArea),
    cityCounts: Object.fromEntries(counts.map((c) => [c.cityId, Number(c.count) || 0])),
    pagination: {
      page: paged ? page : 1,
      limit: paged ? limit : result.count,
      total: result.count,
      totalPages: paged ? Math.max(1, Math.ceil(result.count / limit)) : 1,
    },
  };
}

/** Public: active areas of an active city. */
async function listActiveAreasForCity(cityId) {
  const city = await City.findOne({ where: { id: cityId, isActive: true } });
  if (!city) return [];
  const rows = await CityArea.findAll({
    where: { cityId, isActive: true },
    order: [
      ['sortOrder', 'ASC'],
      ['name', 'ASC'],
    ],
  });
  return rows.map(formatArea);
}

/** Public: search active areas by name, optionally inside one city. */
async function searchActiveAreas({ q, cityId, limit } = {}) {
  const text = String(q || '').trim().slice(0, 80);
  if (!text && !cityId) return [];
  const where = { isActive: true };
  if (text) where.name = { [Op.iLike]: `%${text.replace(/[%_\\]/g, '\\$&')}%` };
  if (cityId) where.cityId = String(cityId);
  const rows = await CityArea.findAll({
    where,
    include: [{ model: City, as: 'city', attributes: ['id', 'name'], where: { isActive: true } }],
    order: [
      ['sortOrder', 'ASC'],
      ['name', 'ASC'],
    ],
    limit: Math.min(Math.max(Number(limit) || 30, 1), 100),
  });
  return rows.map(formatArea);
}

/** Active area by id (optionally required to belong to `cityId`), or null. */
async function findActiveArea(areaId, cityId) {
  if (!areaId) return null;
  const where = { id: String(areaId), isActive: true };
  if (cityId) where.cityId = String(cityId);
  const row = await CityArea.findOne({
    where,
    include: [{ model: City, as: 'city', attributes: ['id', 'name'] }],
  });
  return row ? formatArea(row) : null;
}

async function createArea(body = {}) {
  const cityId = String(body.cityId || '').trim();
  if (!cityId) throw new AppError('City is required', 400);
  await assertCity(cityId);
  const name = String(body.name || '').trim();
  if (!name) throw new AppError('Area name is required', 400);
  await assertUniqueName(cityId, name);

  let sortOrder = Number(body.sortOrder);
  if (!Number.isFinite(sortOrder) || sortOrder <= 0) {
    const max = await CityArea.max('sortOrder', { where: { cityId } });
    sortOrder = (Number(max) || 0) + 1;
  }
  const row = await CityArea.create({
    cityId,
    name,
    latitude: parseCoordinate(body.latitude, { min: -90, max: 90, label: 'Latitude' }) ?? null,
    longitude: parseCoordinate(body.longitude, { min: -180, max: 180, label: 'Longitude' }) ?? null,
    isActive: body.isActive !== false,
    sortOrder,
  });
  return formatArea(row);
}

async function updateArea(id, body = {}) {
  const row = await CityArea.findByPk(id);
  if (!row) throw new AppError('Area not found', 404);
  const updates = {};
  if (body.cityId !== undefined && String(body.cityId) !== row.cityId) {
    await assertCity(String(body.cityId));
    updates.cityId = String(body.cityId);
  }
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) throw new AppError('Area name is required', 400);
    updates.name = name;
  }
  if (updates.name || updates.cityId) {
    await assertUniqueName(updates.cityId || row.cityId, updates.name || row.name, row.id);
  }
  const lat = parseCoordinate(body.latitude, { min: -90, max: 90, label: 'Latitude' });
  const lng = parseCoordinate(body.longitude, { min: -180, max: 180, label: 'Longitude' });
  if (lat !== undefined) updates.latitude = lat;
  if (lng !== undefined) updates.longitude = lng;
  if (body.isActive !== undefined) updates.isActive = Boolean(body.isActive);
  if (body.sortOrder !== undefined) updates.sortOrder = Number(body.sortOrder) || 0;
  await row.update(updates);
  return formatArea(row);
}

async function removeArea(id) {
  const row = await CityArea.findByPk(id);
  if (!row) throw new AppError('Area not found', 404);
  await row.destroy();
  return { id, deleted: true };
}

async function bulkSetAreaStatus(body = {}) {
  if (body.isActive === undefined) throw new AppError('isActive is required', 400);
  const isActive = body.isActive === true || body.isActive === 'true';
  let where;
  if (Array.isArray(body.ids) && body.ids.length) {
    where = { id: { [Op.in]: body.ids.map(String).slice(0, 1000) } };
  } else if (body.cityId) {
    where = { cityId: String(body.cityId) };
  } else {
    throw new AppError('Select areas or a city', 400);
  }
  const [updated] = await CityArea.update({ isActive }, { where });
  return { updated, isActive };
}

/** Look up an area's coordinates on Google Places for the admin form. */
async function lookupAreaLocation({ cityId, name } = {}) {
  const areaName = String(name || '').trim();
  if (!areaName) throw new AppError('Enter the area name first', 400);
  const city = await assertCity(String(cityId || ''));
  const query = [areaName, city.name, city.state, 'India'].filter(Boolean).join(', ');
  const place = await placesService.findPlaceLocation(query);
  if (!place) throw new AppError('Google could not find this area', 404);
  return place;
}

module.exports = {
  formatArea,
  listAreas,
  listActiveAreasForCity,
  searchActiveAreas,
  findActiveArea,
  createArea,
  updateArea,
  removeArea,
  bulkSetAreaStatus,
  lookupAreaLocation,
};
