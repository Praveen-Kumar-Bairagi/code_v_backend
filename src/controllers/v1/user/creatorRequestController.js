const creatorRequestService = require('../../../services/v1/user/creatorRequestService');

async function getMyStatus(req, res, next) {
  try {
    const data = await creatorRequestService.getMyStatus(req.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function submitRequest(req, res, next) {
  try {
    const data = await creatorRequestService.submitRequest(req.userId, req.body || {});
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listRequestsAdmin(req, res, next) {
  try {
    const data = await creatorRequestService.listRequestsAdmin({
      status: req.query.status,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function reviewRequestAdmin(req, res, next) {
  try {
    const data = await creatorRequestService.reviewRequestAdmin(req.adminId, req.params.id, {
      action: req.body?.action,
      adminNote: req.body?.adminNote,
      durationMonths: req.body?.durationMonths,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMyStatus,
  submitRequest,
  listRequestsAdmin,
  reviewRequestAdmin,
};
