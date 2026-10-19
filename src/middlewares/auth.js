const AppError = require('../utils/AppError');
const { verifyToken } = require('../utils/jwt');
const { User, Admin } = require('../models');

function extractBearerToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }
  return header.slice(7).trim();
}

async function authenticateUser(req, res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      throw new AppError('Authentication required', 401);
    }
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch {
      throw new AppError('Invalid or expired token', 401);
    }
    if (decoded.purpose !== 'user' || !decoded.userId) {
      throw new AppError('Invalid token', 401);
    }
    const user = await User.findByPk(decoded.userId);
    if (
      !user ||
      !user.isActive ||
      String(user.mobileNumber || '').startsWith('deleted:')
    ) {
      throw new AppError('Unauthorized', 401);
    }
    if (decoded.sid) {
      const deviceSessionService = require('../services/v1/user/deviceSessionService');
      await deviceSessionService.assertSessionActive(decoded.sid);
    }
    req.user = user;
    req.userId = user.id;
    req.sessionId = decoded.sid || null;
    req.tokenPayload = decoded;
    next();
  } catch (err) {
    next(err);
  }
}

async function authenticateAdmin(req, res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      throw new AppError('Authentication required', 401);
    }
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch {
      throw new AppError('Invalid or expired token', 401);
    }
    if (decoded.purpose !== 'admin' || !decoded.adminId) {
      throw new AppError('Invalid admin token', 401);
    }
    const admin = await Admin.findByPk(decoded.adminId);
    if (!admin) {
      throw new AppError('Unauthorized', 401);
    }
    req.admin = admin;
    req.adminId = admin.id;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  authenticateUser,
  authenticateAdmin,
};
