const supportSubjectService = require('../../../services/v1/common/supportSubjectService');

async function list(req, res, next) {
  try {
    const active =
      req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined;
    const items = await supportSubjectService.listForAdmin({
      search: req.query.search || '',
      active,
    });
    res.json({ success: true, data: { items } });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const data = await supportSubjectService.createSubject(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const data = await supportSubjectService.updateSubject(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const data = await supportSubjectService.removeSubject(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listPublic(req, res, next) {
  try {
    const items = await supportSubjectService.listActiveForApp();
    res.json({ success: true, data: items });
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
};
