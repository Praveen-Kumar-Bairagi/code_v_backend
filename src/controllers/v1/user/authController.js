const authService = require('../../../services/v1/user/authService');

async function requestOtp(req, res, next) {
  try {
    const { mobileNumber } = req.body;
    const data = await authService.requestOtp(mobileNumber);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function verifyOtp(req, res, next) {
  try {
    const { mobileNumber, otp, deviceName, platform, appVersion, userAgent } =
      req.body || {};
    const data = await authService.verifyOtp(mobileNumber, otp, {
      deviceName,
      platform,
      appVersion,
      userAgent: userAgent || req.headers['user-agent'],
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function googleLogin(req, res, next) {
  try {
    const { idToken, deviceName, platform, appVersion, userAgent } = req.body || {};
    const data = await authService.googleLogin(idToken, {
      deviceName,
      platform,
      appVersion,
      userAgent: userAgent || req.headers['user-agent'],
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function requestLinkMobileOtp(req, res, next) {
  try {
    const data = await authService.requestLinkMobileOtp(req.userId, req.body?.mobileNumber);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function verifyLinkMobile(req, res, next) {
  try {
    const { mobileNumber, otp } = req.body || {};
    const data = await authService.verifyLinkMobile(req.userId, mobileNumber, otp);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function register(req, res, next) {
  try {
    const data = await authService.register(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const data = await authService.getMe(req.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function ensureSession(req, res, next) {
  try {
    const { deviceName, platform, appVersion, userAgent } = req.body || {};
    const data = await authService.ensureSession(req.userId, req.sessionId, {
      deviceName,
      platform,
      appVersion,
      userAgent: userAgent || req.headers['user-agent'],
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  requestOtp,
  verifyOtp,
  googleLogin,
  requestLinkMobileOtp,
  verifyLinkMobile,
  register,
  me,
  ensureSession,
};
