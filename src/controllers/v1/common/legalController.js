const legalService = require('../../../services/v1/common/legalService');

async function list(req, res, next) {
  try {
    const data = await legalService.listLegalDocuments();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getBySlug(req, res, next) {
  try {
    const data = await legalService.getLegalBySlug(req.params.slug);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getBySlug,
};
