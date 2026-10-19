const walletService = require('../../../services/v1/user/walletService');

async function getWallet(req, res, next) {
  try {
    const data = await walletService.getWallet(req.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listTransactions(req, res, next) {
  try {
    const data = await walletService.listTransactions(req.userId, {
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function topUp(req, res, next) {
  try {
    const tx = await walletService.topUp(req.userId, req.body?.amount);
    const wallet = await walletService.getWallet(req.userId);
    res.json({ success: true, data: { ...wallet, transaction: tx } });
  } catch (err) {
    next(err);
  }
}

async function requestWithdrawal(req, res, next) {
  try {
    const item = await walletService.requestWithdrawal(req.userId, {
      amount: req.body?.amount,
      upiId: req.body?.upiId,
      note: req.body?.note,
    });
    const wallet = await walletService.getWallet(req.userId);
    res.status(201).json({ success: true, data: { ...wallet, request: item } });
  } catch (err) {
    next(err);
  }
}

async function listMyWithdrawals(req, res, next) {
  try {
    const data = await walletService.listMyWithdrawals(req.userId, {
      limit: req.query.limit,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getWallet,
  listTransactions,
  topUp,
  requestWithdrawal,
  listMyWithdrawals,
};
