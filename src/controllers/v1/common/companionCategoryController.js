const companionCategoryService = require('../../../services/v1/common/companionCategoryService');

async function list(req, res, next) {
  try {
    const items = await companionCategoryService.listCategories({ activeOnly: false });
    res.json({ success: true, data: { items } });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const data = await companionCategoryService.createCategory(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const data = await companionCategoryService.updateCategory(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const data = await companionCategoryService.removeCategory(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listPublic(req, res, next) {
  try {
    const items = await companionCategoryService.listCategories({ activeOnly: true });
    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
}

async function listGroups(req, res, next) {
  try {
    const items = await companionCategoryService.listGroups();
    res.json({ success: true, data: { items } });
  } catch (err) {
    next(err);
  }
}

async function createGroup(req, res, next) {
  try {
    const data = await companionCategoryService.createGroup(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function updateGroup(req, res, next) {
  try {
    const data = await companionCategoryService.updateGroup(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function removeGroup(req, res, next) {
  try {
    const data = await companionCategoryService.removeGroup(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  create,
  update,
  remove,
  listPublic,
  listGroups,
  createGroup,
  updateGroup,
  removeGroup,
};
