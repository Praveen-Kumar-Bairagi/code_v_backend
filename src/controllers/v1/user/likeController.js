const likeService = require('../../../services/v1/user/likeService');

async function sendLike(req, res, next) {
  try {
    const toUserId = req.body?.toUserId || req.body?.userId;
    const data = await likeService.sendLike(req.userId, toUserId);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listReceived(req, res, next) {
  try {
    const status = req.query.status || 'pending';
    const data = await likeService.listReceived(req.userId, { status });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listSent(req, res, next) {
  try {
    const data = await likeService.listSent(req.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listSkips(req, res, next) {
  try {
    const data = await likeService.listSkips(req.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function skipPerson(req, res, next) {
  try {
    const toUserId = req.body?.toUserId || req.body?.userId;
    const data = await likeService.skipPerson(req.userId, toUserId);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function undoSkip(req, res, next) {
  try {
    const data = await likeService.undoSkip(req.userId, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function respond(req, res, next) {
  try {
    const action = req.body?.action;
    const data = await likeService.respondToLike(req.userId, req.params.id, action);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function statusWith(req, res, next) {
  try {
    const data = await likeService.getStatusBetween(req.userId, req.params.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  sendLike,
  listReceived,
  listSent,
  listSkips,
  skipPerson,
  undoSkip,
  respond,
  statusWith,
};
