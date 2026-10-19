'use strict';

const deviceSessionService = require('../../../services/v1/user/deviceSessionService');
const accountLifecycleService = require('../../../services/v1/user/accountLifecycleService');

async function listSessions(req, res, next) {
  try {
    const data = await deviceSessionService.listSessions(req.userId, req.sessionId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function revokeSession(req, res, next) {
  try {
    const data = await deviceSessionService.revokeSession(
      req.userId,
      req.params.sessionId,
      req.sessionId
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function registerDevice(req, res, next) {
  try {
    const data = await deviceSessionService.registerOrUpdateDevice(
      req.userId,
      req.sessionId,
      req.body || {}
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function requestDeactivateOtp(req, res, next) {
  try {
    const data = await accountLifecycleService.requestDeactivateOtp(req.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function deactivateAccount(req, res, next) {
  try {
    const data = await accountLifecycleService.deactivateAccount(req.userId, req.body || {});
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function requestDeleteOtp(req, res, next) {
  try {
    const data = await accountLifecycleService.requestDeleteOtp(req.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function deleteAccount(req, res, next) {
  try {
    const data = await accountLifecycleService.deleteAccount(req.userId, req.body || {});
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listSessions,
  revokeSession,
  registerDevice,
  requestDeactivateOtp,
  deactivateAccount,
  requestDeleteOtp,
  deleteAccount,
};
