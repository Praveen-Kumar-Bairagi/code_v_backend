const { CompanionCategory, CompanionCategoryGroup } = require('../../../models');
const AppError = require('../../../utils/AppError');

function formatGroup(row) {
  if (!row) return null;
  const plain = row.toJSON ? row.toJSON() : row;
  return {
    id: plain.id,
    name: plain.name,
    emoji: plain.emoji,
    description: plain.description,
    isActive: plain.isActive,
    sortOrder: plain.sortOrder,
  };
}

function formatCategory(row) {
  const plain = row.toJSON ? row.toJSON() : row;
  return {
    id: plain.id,
    name: plain.name,
    emoji: plain.emoji,
    description: plain.description,
    color: plain.color,
    accentColor: plain.accentColor,
    amount: Math.max(0, Math.round(Number(plain.amount) || 0)),
    isActive: plain.isActive,
    sortOrder: plain.sortOrder,
    groupId: plain.groupId || null,
    group: plain.group ? formatGroup(plain.group) : null,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

const groupInclude = { model: CompanionCategoryGroup, as: 'group', required: false };

/** Ungrouped categories go last; otherwise group order, then category order, then name. */
function compareCategories(a, b) {
  const ga = a.group ? a.group.sortOrder : Number.MAX_SAFE_INTEGER;
  const gb = b.group ? b.group.sortOrder : Number.MAX_SAFE_INTEGER;
  if (ga !== gb) return ga - gb;
  if ((a.groupId || '') !== (b.groupId || '')) return String(a.groupId || '').localeCompare(String(b.groupId || ''));
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return String(a.name).localeCompare(String(b.name));
}

async function listCategories({ activeOnly = true } = {}) {
  const where = {};
  if (activeOnly) where.isActive = true;
  const rows = await CompanionCategory.findAll({ where, include: [groupInclude] });
  return rows
    .map(formatCategory)
    .filter((c) => !activeOnly || !c.group || c.group.isActive)
    .sort(compareCategories);
}

async function resolveGroupId(value) {
  if (value === null || value === '' || value === undefined) return null;
  const group = await CompanionCategoryGroup.findByPk(String(value));
  if (!group) throw new AppError('Main category not found', 400);
  return group.id;
}

async function createCategory(payload) {
  const name = String(payload.name || '').trim();
  if (!name) throw new AppError('Category name is required', 400);
  const amount = Math.round(Number(payload.amount));
  if (!Number.isFinite(amount) || amount < 99) {
    throw new AppError('Default activity amount must be at least ₹99', 400);
  }
  const row = await CompanionCategory.create({
    name,
    emoji: String(payload.emoji || '✨').trim() || '✨',
    description: payload.description ? String(payload.description).trim() : null,
    color: payload.color || '#E8F4FF',
    accentColor: payload.accentColor || '#1D6FD8',
    amount,
    isActive: payload.isActive !== false,
    sortOrder: Number.isFinite(Number(payload.sortOrder)) ? Number(payload.sortOrder) : 0,
    groupId: await resolveGroupId(payload.groupId),
  });
  await row.reload({ include: [groupInclude] });
  return formatCategory(row);
}

async function updateCategory(id, payload) {
  const row = await CompanionCategory.findByPk(id);
  if (!row) throw new AppError('Category not found', 404);

  const updates = {};
  if (payload.name != null) {
    const name = String(payload.name).trim();
    if (!name) throw new AppError('Category name is required', 400);
    updates.name = name;
  }
  if (payload.emoji != null) updates.emoji = String(payload.emoji).trim() || '✨';
  if (payload.description !== undefined) {
    updates.description = payload.description ? String(payload.description).trim() : null;
  }
  if (payload.color != null) updates.color = payload.color;
  if (payload.accentColor != null) updates.accentColor = payload.accentColor;
  if (payload.amount !== undefined) {
    const amount = Math.round(Number(payload.amount));
    if (!Number.isFinite(amount) || amount < 99) {
      throw new AppError('Default activity amount must be at least ₹99', 400);
    }
    updates.amount = amount;
  }
  if (payload.isActive !== undefined) updates.isActive = Boolean(payload.isActive);
  if (payload.sortOrder !== undefined) updates.sortOrder = Number(payload.sortOrder) || 0;
  if (payload.groupId !== undefined) updates.groupId = await resolveGroupId(payload.groupId);

  await row.update(updates);
  await row.reload({ include: [groupInclude] });
  return formatCategory(row);
}

async function removeCategory(id) {
  const row = await CompanionCategory.findByPk(id);
  if (!row) throw new AppError('Category not found', 404);
  await row.update({ isActive: false });
  return { id, deleted: true };
}

/* ---- Main categories (groups) ---- */

async function listGroups({ activeOnly = false } = {}) {
  const where = {};
  if (activeOnly) where.isActive = true;
  const rows = await CompanionCategoryGroup.findAll({
    where,
    order: [
      ['sortOrder', 'ASC'],
      ['name', 'ASC'],
    ],
  });
  const counts = await CompanionCategory.count({ group: ['groupId'], where: { isActive: true } });
  const countMap = new Map(counts.map((c) => [c.groupId, Number(c.count) || 0]));
  return rows.map((row) => ({ ...formatGroup(row), categoryCount: countMap.get(row.id) || 0 }));
}

async function createGroup(payload) {
  const name = String(payload.name || '').trim();
  if (!name) throw new AppError('Main category name is required', 400);
  const row = await CompanionCategoryGroup.create({
    name,
    emoji: String(payload.emoji || '✨').trim() || '✨',
    description: payload.description ? String(payload.description).trim() : null,
    isActive: payload.isActive !== false,
    sortOrder: Number.isFinite(Number(payload.sortOrder)) ? Number(payload.sortOrder) : 0,
  });
  return formatGroup(row);
}

async function updateGroup(id, payload) {
  const row = await CompanionCategoryGroup.findByPk(id);
  if (!row) throw new AppError('Main category not found', 404);
  const updates = {};
  if (payload.name != null) {
    const name = String(payload.name).trim();
    if (!name) throw new AppError('Main category name is required', 400);
    updates.name = name;
  }
  if (payload.emoji != null) updates.emoji = String(payload.emoji).trim() || '✨';
  if (payload.description !== undefined) {
    updates.description = payload.description ? String(payload.description).trim() : null;
  }
  if (payload.isActive !== undefined) updates.isActive = Boolean(payload.isActive);
  if (payload.sortOrder !== undefined) updates.sortOrder = Number(payload.sortOrder) || 0;
  await row.update(updates);
  return formatGroup(row);
}

/** Sub-categories become ungrouped; they are not deleted. */
async function removeGroup(id) {
  const row = await CompanionCategoryGroup.findByPk(id);
  if (!row) throw new AppError('Main category not found', 404);
  await CompanionCategory.update({ groupId: null }, { where: { groupId: id } });
  await row.destroy();
  return { id, deleted: true };
}

module.exports = {
  formatCategory,
  formatGroup,
  listCategories,
  createCategory,
  updateCategory,
  removeCategory,
  listGroups,
  createGroup,
  updateGroup,
  removeGroup,
};
