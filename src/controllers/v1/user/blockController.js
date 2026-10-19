const blockService = require('../../../services/v1/user/blockService');

async function listBlocked(req, res, next) {
  try {
    const data = await blockService.listBlockedUsers(req.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function block(req, res, next) {
  try {
    const blockedUserId = req.body?.userId || req.body?.blockedUserId;
    const data = await blockService.blockUser(req.userId, blockedUserId);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function unblock(req, res, next) {
  try {
    const data = await blockService.unblockUser(req.userId, req.params.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function unmatch(req, res, next) {
  try {
    const otherUserId = req.body?.userId || req.body?.otherUserId;
    const data = await blockService.unmatchUser(req.userId, otherUserId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listBlocked,
  block,
  unblock,
  unmatch,
};
