const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signAccessToken(payload, options = {}) {
  return jwt.sign(payload, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
    ...options,
  });
}

function signMobileVerifiedToken(mobileNumber) {
  return jwt.sign(
    { mobileNumber, purpose: 'registration' },
    env.jwt.secret,
    { expiresIn: '15m' }
  );
}

function signGoogleVerifiedToken({ uid, email }) {
  return jwt.sign(
    { googleUid: uid, email, purpose: 'google_registration' },
    env.jwt.secret,
    { expiresIn: '30m' }
  );
}

function signAdminToken(admin) {
  return jwt.sign(
    { adminId: admin.id, purpose: 'admin' },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );
}

function verifyToken(token) {
  return jwt.verify(token, env.jwt.secret);
}

module.exports = {
  signAccessToken,
  signMobileVerifiedToken,
  signGoogleVerifiedToken,
  signAdminToken,
  verifyToken,
};
