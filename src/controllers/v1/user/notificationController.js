const notificationService = require('../../../services/v1/user/notificationService');
const pushTokenService = require('../../../services/v1/user/pushTokenService');

async function list(req, res, next) {
  try {
    const data = await notificationService.listNotifications(req.userId, {
      limit: req.query.limit,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function unreadCount(req, res, next) {
  try {
    const data = await notificationService.getUnreadCount(req.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function markRead(req, res, next) {
  try {
    const data = await notificationService.markRead(req.userId, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function markAllRead(req, res, next) {
  try {
    const data = await notificationService.markAllRead(req.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function registerPushToken(req, res, next) {
  try {
    const data = await pushTokenService.registerPushToken(
      req.userId,
      req.sessionId,
      {
        token: req.body?.token,
        platform: req.body?.platform,
      }
    );
    res.json({ success: true, data: { id: data.id, registered: true } });
  } catch (err) {
    next(err);
  }
}

async function unregisterPushToken(req, res, next) {
  try {
    const data = await pushTokenService.unregisterPushToken(
      req.userId,
      req.body?.token,
      req.sessionId
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  unreadCount,
  markRead,
  markAllRead,
  registerPushToken,
  unregisterPushToken,
};
