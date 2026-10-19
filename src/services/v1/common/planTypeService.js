const { PlanType } = require('../../../models');
const AppError = require('../../../utils/AppError');

function formatPlanType(row) {
  const json = row.toJSON ? row.toJSON() : row;
  return {
    id: json.id,
    name: json.name,
    emoji: json.emoji || null,
    description: json.description || null,
    isActive: json.isActive,
    sortOrder: json.sortOrder,
  };
}

async function listPlanTypes({ includeInactive = false } = {}) {
  const rows = await PlanType.findAll({
    where: includeInactive ? {} : { isActive: true },
    order: [
      ['sortOrder', 'ASC'],
      ['name', 'ASC'],
    ],
  });
  return rows.map(formatPlanType);
}

function pickFields(body = {}, { partial = false } = {}) {
  const out = {};
  if (!partial || body.name !== undefined) {
    const name = String(body.name || '').trim();
    if (!name) throw new AppError('Plan name is required', 400);
    out.name = name.slice(0, 80);
  }
  if (body.emoji !== undefined) out.emoji = String(body.emoji || '').trim().slice(0, 16) || null;
  if (body.description !== undefined) {
    out.description = String(body.description || '').trim().slice(0, 200) || null;
  }
  if (body.isActive !== undefined) out.isActive = Boolean(body.isActive);
  if (body.sortOrder !== undefined && body.sortOrder !== '') out.sortOrder = Number(body.sortOrder) || 0;
  return out;
}

async function createPlanType(body) {
  const fields = pickFields(body);
  if (fields.sortOrder == null || fields.sortOrder <= 0) {
    fields.sortOrder = (Number(await PlanType.max('sortOrder')) || 0) + 1;
  }
  return formatPlanType(await PlanType.create(fields));
}

async function updatePlanType(id, body) {
  const row = await PlanType.findByPk(id);
  if (!row) throw new AppError('Plan type not found', 404);
  await row.update(pickFields(body, { partial: true }));
  return formatPlanType(row);
}

async function removePlanType(id) {
  const row = await PlanType.findByPk(id);
  if (!row) throw new AppError('Plan type not found', 404);
  await row.destroy();
  return { id, deleted: true };
}

module.exports = {
  formatPlanType,
  listPlanTypes,
  createPlanType,
  updatePlanType,
  removePlanType,
};
