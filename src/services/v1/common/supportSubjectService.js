const { Op } = require('sequelize');
const { SupportSubject } = require('../../../models');
const AppError = require('../../../utils/AppError');

function formatSubject(row) {
  const plain = row.toJSON ? row.toJSON() : row;
  return {
    id: plain.id,
    name: plain.name,
    isActive: !!plain.isActive,
    isOther: !!plain.isOther,
    sortOrder: plain.sortOrder,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

async function listActiveForApp() {
  const rows = await SupportSubject.findAll({
    where: { isActive: true },
    order: [
      ['isOther', 'ASC'],
      ['sortOrder', 'ASC'],
      ['name', 'ASC'],
    ],
  });
  return rows.map(formatSubject);
}

async function listForAdmin({ search = '', active } = {}) {
  const where = {};
  if (active === true || active === false) where.isActive = active;
  if (search && String(search).trim()) {
    where.name = { [Op.iLike]: `%${String(search).trim()}%` };
  }
  const rows = await SupportSubject.findAll({
    where,
    order: [
      ['isOther', 'ASC'],
      ['sortOrder', 'ASC'],
      ['name', 'ASC'],
    ],
  });
  return rows.map(formatSubject);
}

async function createSubject({ name, isActive = true, sortOrder = 0 } = {}) {
  const clean = String(name || '').trim();
  if (!clean) throw new AppError('Subject name is required', 400);
  if (clean.length > 160) throw new AppError('Subject name is too long', 400);
  if (/^other$/i.test(clean)) {
    throw new AppError('"Other" is a system subject and already exists', 400);
  }

  const existing = await SupportSubject.findOne({
    where: { name: { [Op.iLike]: clean } },
  });
  if (existing) throw new AppError('A subject with this name already exists', 409);

  const row = await SupportSubject.create({
    name: clean,
    isActive: isActive !== false,
    isOther: false,
    sortOrder: Number(sortOrder) || 0,
  });
  return formatSubject(row);
}

async function updateSubject(id, payload = {}) {
  const row = await SupportSubject.findByPk(id);
  if (!row) throw new AppError('Subject not found', 404);

  if (payload.name !== undefined) {
    const clean = String(payload.name || '').trim();
    if (!clean) throw new AppError('Subject name is required', 400);
    if (clean.length > 160) throw new AppError('Subject name is too long', 400);
    if (!row.isOther && /^other$/i.test(clean)) {
      throw new AppError('Cannot rename subject to "Other"', 400);
    }
    if (!row.isOther) row.name = clean;
  }
  if (payload.isActive !== undefined) row.isActive = !!payload.isActive;
  if (payload.sortOrder !== undefined && !row.isOther) {
    row.sortOrder = Number(payload.sortOrder) || 0;
  }
  await row.save();
  return formatSubject(row);
}

async function removeSubject(id) {
  const row = await SupportSubject.findByPk(id);
  if (!row) throw new AppError('Subject not found', 404);
  if (row.isOther) throw new AppError('Cannot delete the "Other" subject', 400);
  await row.destroy();
  return { id, deleted: true };
}

async function getSubjectById(id) {
  if (!id) return null;
  return SupportSubject.findByPk(id);
}

module.exports = {
  listActiveForApp,
  listForAdmin,
  createSubject,
  updateSubject,
  removeSubject,
  getSubjectById,
  formatSubject,
};
