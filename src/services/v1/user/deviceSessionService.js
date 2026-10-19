'use strict';

const { DeviceSession, User } = require('../../../models');
const AppError = require('../../../utils/AppError');
const { signAccessToken } = require('../../../utils/jwt');
const { currentIp } = require('../../../utils/requestContext');

function normalizeMeta(meta = {}) {
  return {
    deviceName: meta.deviceName
      ? String(meta.deviceName).slice(0, 120)
      : 'Unknown device',
    platform: meta.platform ? String(meta.platform).slice(0, 40) : null,
    appVersion: meta.appVersion ? String(meta.appVersion).slice(0, 40) : null,
    userAgent: meta.userAgent ? String(meta.userAgent).slice(0, 500) : null,
  };
}

async function touchUserLastActive(userId, at = new Date()) {
  if (!userId) return;
  await User.update({ lastActiveAt: at }, { where: { id: userId } });
}

async function createSessionAndToken(userId, deviceMeta = {}) {
  const meta = normalizeMeta(deviceMeta);
  const now = new Date();
  const ip = currentIp();
  const session = await DeviceSession.create({
    userId,
    ...meta,
    ipAddress: ip,
    lastIpAddress: ip,
    lastActiveAt: now,
    revokedAt: null,
  });
  await touchUserLastActive(userId, now);
  const token = signAccessToken({
    userId,
    purpose: 'user',
    sid: session.id,
  });
  return { token, session };
}

async function assertSessionActive(sid) {
  if (!sid) return null;
  const session = await DeviceSession.findByPk(sid);
  if (!session || session.revokedAt) {
    throw new AppError('Session expired. Please log in again.', 401);
  }
  const twoMin = 2 * 60 * 1000;
  const ip = currentIp();
  const ipChanged = !!ip && ip !== session.lastIpAddress;
  if (
    ipChanged ||
    !session.lastActiveAt ||
    Date.now() - new Date(session.lastActiveAt).getTime() > twoMin
  ) {
    const now = new Date();
    session.lastActiveAt = now;
    if (ip) session.lastIpAddress = ip;
    await session.save({ fields: ['lastActiveAt', 'lastIpAddress'] });
    await touchUserLastActive(session.userId, now);
  }
  return session;
}

async function listSessions(userId, currentSid) {
  const rows = await DeviceSession.findAll({
    where: { userId, revokedAt: null },
    order: [
      ['lastActiveAt', 'DESC'],
      ['createdAt', 'DESC'],
    ],
  });
  return rows.map((row) => row.toPublicJSON(currentSid));
}

async function revokeSession(userId, sessionId, currentSid) {
  const session = await DeviceSession.findOne({
    where: { id: sessionId, userId, revokedAt: null },
  });
  if (!session) throw new AppError('Session not found', 404);
  session.revokedAt = new Date();
  await session.save();
  const { ExpoPushToken } = require('../../../models');
  await ExpoPushToken.update(
    { disabledAt: new Date() },
    { where: { deviceSessionId: session.id, disabledAt: null } }
  );
  return { revoked: true, wasCurrent: currentSid === session.id };
}

async function revokeAllSessions(userId) {
  await DeviceSession.update(
    { revokedAt: new Date() },
    { where: { userId, revokedAt: null } }
  );
  return { revoked: true };
}

async function registerOrUpdateDevice(userId, currentSid, deviceMeta = {}) {
  const meta = normalizeMeta(deviceMeta);
  const now = new Date();
  let session = currentSid ? await DeviceSession.findByPk(currentSid) : null;
  if (session && session.userId === userId && !session.revokedAt) {
    Object.assign(session, meta, { lastActiveAt: now }, currentIp() ? { lastIpAddress: currentIp() } : {});
    await session.save();
  } else {
    session = await DeviceSession.create({
      userId,
      ...meta,
      ipAddress: currentIp(),
      lastIpAddress: currentIp(),
      lastActiveAt: now,
      revokedAt: null,
    });
  }
  await touchUserLastActive(userId, now);
  return session.toPublicJSON(currentSid || session.id);
}

module.exports = {
  createSessionAndToken,
  assertSessionActive,
  listSessions,
  revokeSession,
  revokeAllSessions,
  registerOrUpdateDevice,
};
