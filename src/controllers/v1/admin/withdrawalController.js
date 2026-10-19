const walletService = require('../../../services/v1/user/walletService');

async function listWithdrawals(req, res, next) {
  try {
    const data = await walletService.listWithdrawalsAdmin({
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

async function reviewWithdrawal(req, res, next) {
  try {
    const data = await walletService.reviewWithdrawal(req.adminId, req.params.id, {
      action: req.body?.action,
      adminNote: req.body?.adminNote,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listWithdrawals,
  reviewWithdrawal,
};
