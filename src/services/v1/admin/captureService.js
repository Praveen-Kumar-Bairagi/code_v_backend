const { Op } = require('sequelize');
const {
  CaptureSession,
  CaptureScreenshot,
  CaptureRecording,
  SecurityAuditEvent,
  User,
} = require('../../../models');
const AppError = require('../../../utils/AppError');
const { emitToUser } = require('../../../socket/io');
const {
  assertImageUpload,
  assertRecordingUpload,
  saveCaptureBuffer,
  saveRecordingBuffer,
  deleteCaptureFile,
  dayKeyFrom,
  signAccessToken,
  readCaptureFile,
} = require('../../captureStorage');

async function audit({ actorType, actorId, action, targetUserId, meta }) {
  try {
    await SecurityAuditEvent.create({
      actorType,
      actorId: actorId || null,
      action,
      targetUserId: targetUserId || null,
      meta: meta || null,
    });
  } catch {
    // never block primary flow
  }
}

function isUserOnline(userId) {
  try {
    const { isUserOnline: online } = require('../../../socket/io');
    return online(userId);
  } catch {
    return false;
  }
}

async function getDeviceStatus(userId) {
  const user = await User.findByPk(userId, {
    attributes: ['id', 'firstName', 'lastName', 'mobileNumber', 'lastActiveAt', 'isActive'],
  });
  if (!user) throw new AppError('User not found', 404);

  const activeSession = await CaptureSession.findOne({
    where: { userId, status: { [Op.in]: ['pending', 'active'] } },
    order: [['createdAt', 'DESC']],
  });

  return {
    userId: user.id,
    name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
    mobileNumber: user.mobileNumber,
    lastActiveAt: user.lastActiveAt,
    online: isUserOnline(userId),
    isActive: !!user.isActive,
    activeSession: activeSession
      ? {
          id: activeSession.id,
          status: activeSession.status,
          deviceId: activeSession.deviceId,
          startedAt: activeSession.startedAt,
          createdAt: activeSession.createdAt,
        }
      : null,
  };
}

async function requestSession(adminId, userId, { deviceId } = {}) {
  const user = await User.findByPk(userId);
  if (!user || !user.isActive) throw new AppError('User not found', 404);

  const existing = await CaptureSession.findOne({
    where: { userId, status: { [Op.in]: ['pending', 'active'] } },
  });
  if (existing) {
    throw new AppError('A capture session is already open for this user', 409);
  }

  const session = await CaptureSession.create({
    userId,
    adminId,
    deviceId: deviceId || null,
    status: 'pending',
  });

  emitToUser(userId, 'capture:session-request', {
    sessionId: session.id,
    intervalMs: 10_000,
  });

  await audit({
    actorType: 'admin',
    actorId: adminId,
    action: 'capture.session.request',
    targetUserId: userId,
    meta: { sessionId: session.id },
  });

  return session;
}

async function endSession(adminId, sessionId, reason = 'admin_ended') {
  const session = await CaptureSession.findByPk(sessionId);
  if (!session) throw new AppError('Session not found', 404);
  if (session.status === 'ended') return session;

  session.status = 'ended';
  session.endedAt = new Date();
  session.endReason = reason;
  await session.save();

  emitToUser(session.userId, 'capture:session-ended', {
    sessionId: session.id,
    reason,
  });

  await audit({
    actorType: 'admin',
    actorId: adminId,
    action: 'capture.session.end',
    targetUserId: session.userId,
    meta: { sessionId: session.id, reason },
  });

  return session;
}

async function acknowledgeSession(userId, sessionId, { deviceId, accepted } = {}) {
  const session = await CaptureSession.findByPk(sessionId);
  if (!session || String(session.userId) !== String(userId)) {
    throw new AppError('Session not found', 404);
  }
  if (session.status === 'ended') return session;

  if (!accepted) {
    session.status = 'ended';
    session.endedAt = new Date();
    session.endReason = 'user_denied';
    await session.save();
    await audit({
      actorType: 'user',
      actorId: userId,
      action: 'capture.session.denied',
      targetUserId: userId,
      meta: { sessionId },
    });
    return session;
  }

  session.status = 'active';
  session.startedAt = session.startedAt || new Date();
  if (deviceId) session.deviceId = deviceId;
  await session.save();

  await audit({
    actorType: 'user',
    actorId: userId,
    action: 'capture.session.active',
    targetUserId: userId,
    meta: { sessionId, deviceId: deviceId || null },
  });

  return session;
}

async function getActiveSessionForUser(userId) {
  return CaptureSession.findOne({
    where: { userId, status: 'active' },
    order: [['startedAt', 'DESC']],
  });
}

async function uploadScreenshot(userId, file, body = {}) {
  const sessionId = body.sessionId;
  if (!sessionId) throw new AppError('sessionId is required', 400);

  const session = await CaptureSession.findByPk(sessionId);
  if (!session || String(session.userId) !== String(userId)) {
    throw new AppError('Session not found', 404);
  }
  if (session.status !== 'active') {
    throw new AppError('Capture session is not active', 409);
  }

  const mimeType = file.mimetype || 'image/jpeg';
  const width = body.width != null ? Number(body.width) : null;
  const height = body.height != null ? Number(body.height) : null;
  assertImageUpload({ mimetype: mimeType, size: file.size || file.buffer?.length, width, height });

  const saved = await saveCaptureBuffer({
    userId,
    sessionId,
    buffer: file.buffer,
    mimeType,
  });

  const capturedAt = body.capturedAt ? new Date(body.capturedAt) : new Date();
  const row = await CaptureScreenshot.create({
    sessionId,
    userId,
    storageKey: saved.storageKey,
    mimeType,
    byteSize: saved.byteSize,
    width: Number.isFinite(width) ? width : null,
    height: Number.isFinite(height) ? height : null,
    deviceId: body.deviceId || session.deviceId || null,
    dayKey: dayKeyFrom(capturedAt),
    capturedAt,
  });

  await audit({
    actorType: 'user',
    actorId: userId,
    action: 'capture.screenshot.upload',
    targetUserId: userId,
    meta: {
      sessionId,
      screenshotId: row.id,
      byteSize: row.byteSize,
      width: row.width,
      height: row.height,
      // never log image contents
    },
  });

  return {
    id: row.id,
    sessionId: row.sessionId,
    capturedAt: row.capturedAt,
    dayKey: row.dayKey,
    width: row.width,
    height: row.height,
    byteSize: row.byteSize,
  };
}

async function listScreenshots(userId, query = {}) {
  const where = { userId };
  if (query.sessionId) where.sessionId = query.sessionId;
  if (query.dayKey) where.dayKey = String(query.dayKey);
  if (query.from || query.to) {
    where.capturedAt = {};
    if (query.from) where.capturedAt[Op.gte] = new Date(query.from);
    if (query.to) where.capturedAt[Op.lte] = new Date(query.to);
  }

  const limit = Math.min(Number(query.limit) || 100, 500);
  const offset = Number(query.offset) || 0;

  const { rows, count } = await CaptureScreenshot.findAndCountAll({
    where,
    order: [['capturedAt', 'DESC']],
    limit,
    offset,
  });

  return {
    total: count,
    items: rows.map((r) => ({
      id: r.id,
      sessionId: r.sessionId,
      deviceId: r.deviceId,
      dayKey: r.dayKey,
      capturedAt: r.capturedAt,
      width: r.width,
      height: r.height,
      byteSize: r.byteSize,
      mimeType: r.mimeType,
    })),
  };
}

async function listDaySummary(userId) {
  const rows = await CaptureScreenshot.findAll({
    where: { userId },
    attributes: [
      'dayKey',
      [CaptureScreenshot.sequelize.fn('COUNT', CaptureScreenshot.sequelize.col('id')), 'count'],
    ],
    group: ['dayKey'],
    order: [['dayKey', 'DESC']],
    raw: true,
  });
  return rows.map((r) => ({ dayKey: r.dayKey, count: Number(r.count) || 0 }));
}

async function deleteScreenshots(adminId, userId, ids = []) {
  const list = Array.isArray(ids) ? ids.filter(Boolean) : [];
  if (!list.length) throw new AppError('No screenshot ids provided', 400);

  const rows = await CaptureScreenshot.findAll({
    where: { userId, id: { [Op.in]: list } },
  });

  for (const row of rows) {
    await deleteCaptureFile(row.storageKey);
    await row.destroy();
  }

  await audit({
    actorType: 'admin',
    actorId: adminId,
    action: 'capture.screenshot.delete',
    targetUserId: userId,
    meta: { count: rows.length, ids: rows.map((r) => r.id) },
  });

  return { deleted: rows.length };
}

async function getScreenshotAccess(adminId, screenshotId) {
  const row = await CaptureScreenshot.findByPk(screenshotId);
  if (!row) throw new AppError('Screenshot not found', 404);
  const token = signAccessToken({ screenshotId: row.id, adminId }, '5m');
  return {
    screenshotId: row.id,
    mimeType: row.mimeType,
    expiresIn: 300,
    token,
    // admin client uses authenticated file route preferentially
  };
}

async function loadScreenshotFile(screenshotId) {
  const row = await CaptureScreenshot.findByPk(screenshotId);
  if (!row) throw new AppError('Screenshot not found', 404);
  const buffer = await readCaptureFile(row.storageKey);
  return { row, buffer };
}

async function purgeOlderThanDays(days = 30) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await CaptureScreenshot.findAll({
    where: { capturedAt: { [Op.lt]: cutoff } },
    limit: 500,
  });
  let deleted = 0;
  for (const row of rows) {
    await deleteCaptureFile(row.storageKey);
    await row.destroy();
    deleted += 1;
  }
  if (deleted) {
    await audit({
      actorType: 'system',
      actorId: null,
      action: 'capture.retention.purge',
      meta: { deleted, olderThanDays: days },
    });
  }
  return { deleted };
}

async function saveRecording(adminId, userId, file, body = {}) {
  if (!file?.buffer) throw new AppError('Recording file is required', 400);
  assertRecordingUpload({ mimetype: file.mimetype, size: file.size || file.buffer.length });

  const user = await User.findByPk(userId, { attributes: ['id', 'isActive'] });
  if (!user || !user.isActive) throw new AppError('User not found', 404);

  let sessionId = body.sessionId || null;
  if (sessionId) {
    const session = await CaptureSession.findByPk(sessionId, { attributes: ['id', 'userId'] });
    if (!session || String(session.userId) !== String(userId)) {
      sessionId = null;
    }
  }

  const startedAt = body.startedAt ? new Date(body.startedAt) : null;
  const endedAt = body.endedAt ? new Date(body.endedAt) : new Date();
  const { storageKey, byteSize } = await saveRecordingBuffer({
    userId,
    sessionId,
    buffer: file.buffer,
    mimeType: file.mimetype,
  });

  const row = await CaptureRecording.create({
    userId,
    sessionId,
    adminId: adminId || null,
    storageKey,
    mimeType: file.mimetype || 'video/webm',
    byteSize,
    width: body.width != null ? Number(body.width) : null,
    height: body.height != null ? Number(body.height) : null,
    durationSec: body.durationSec != null ? Number(body.durationSec) : null,
    frameCount: body.frameCount != null ? Number(body.frameCount) : 0,
    startedAt,
    endedAt,
    dayKey: dayKeyFrom(endedAt || new Date()),
  });

  await audit({
    actorType: 'admin',
    actorId: adminId,
    action: 'capture.recording.save',
    targetUserId: userId,
    meta: { recordingId: row.id, byteSize, frameCount: row.frameCount },
  });

  return {
    id: row.id,
    userId: row.userId,
    sessionId: row.sessionId,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    durationSec: row.durationSec,
    frameCount: row.frameCount,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    createdAt: row.createdAt,
  };
}

async function listRecordings(userId, query = {}) {
  const limit = Math.min(Number(query.limit) || 50, 100);
  const rows = await CaptureRecording.findAll({
    where: { userId },
    order: [['createdAt', 'DESC']],
    limit,
  });
  return rows.map((r) => ({
    id: r.id,
    sessionId: r.sessionId,
    mimeType: r.mimeType,
    byteSize: r.byteSize,
    width: r.width,
    height: r.height,
    durationSec: r.durationSec,
    frameCount: r.frameCount,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    createdAt: r.createdAt,
  }));
}

async function getRecordingAccess(adminId, recordingId) {
  const row = await CaptureRecording.findByPk(recordingId);
  if (!row) throw new AppError('Recording not found', 404);
  const token = signAccessToken({ recordingId: row.id, adminId }, '10m');
  return { recordingId: row.id, token, mimeType: row.mimeType };
}

async function loadRecordingFile(recordingId) {
  const row = await CaptureRecording.findByPk(recordingId);
  if (!row) throw new AppError('Recording not found', 404);
  const buffer = await readCaptureFile(row.storageKey);
  return { row, buffer };
}

async function deleteRecordings(adminId, userId, ids = []) {
  const list = [...new Set((ids || []).map(String).filter(Boolean))];
  if (!list.length) throw new AppError('No recording ids provided', 400);
  const rows = await CaptureRecording.findAll({
    where: { userId, id: { [Op.in]: list } },
  });
  let deleted = 0;
  for (const row of rows) {
    await deleteCaptureFile(row.storageKey);
    await row.destroy();
    deleted += 1;
  }
  await audit({
    actorType: 'admin',
    actorId: adminId,
    action: 'capture.recording.delete',
    targetUserId: userId,
    meta: { deleted, ids: list },
  });
  return { deleted };
}

module.exports = {
  getDeviceStatus,
  requestSession,
  endSession,
  acknowledgeSession,
  getActiveSessionForUser,
  uploadScreenshot,
  listScreenshots,
  listDaySummary,
  deleteScreenshots,
  getScreenshotAccess,
  loadScreenshotFile,
  purgeOlderThanDays,
  saveRecording,
  listRecordings,
  getRecordingAccess,
  loadRecordingFile,
  deleteRecordings,
};
