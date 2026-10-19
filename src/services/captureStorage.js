const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const ROOT = path.resolve(__dirname, '../../private/captures');
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_RECORDING_BYTES = 100 * 1024 * 1024;
const MAX_DIMENSION = 4096;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const ALLOWED_RECORDING_MIME = new Set(['video/webm', 'video/mp4']);

function ensureRoot() {
  if (!fs.existsSync(ROOT)) {
    fs.mkdirSync(ROOT, { recursive: true, mode: 0o700 });
  }
}

function dayKeyFrom(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function extForMime(mime) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

function assertImageUpload({ mimetype, size, width, height }) {
  if (!ALLOWED_MIME.has(String(mimetype || '').toLowerCase())) {
    const err = new Error('Only JPEG, PNG, and WebP images are allowed');
    err.statusCode = 400;
    throw err;
  }
  if (!size || size <= 0 || size > MAX_BYTES) {
    const err = new Error(`Image must be between 1 byte and ${MAX_BYTES} bytes`);
    err.statusCode = 400;
    throw err;
  }
  if (width != null && (width < 1 || width > MAX_DIMENSION)) {
    const err = new Error('Invalid image width');
    err.statusCode = 400;
    throw err;
  }
  if (height != null && (height < 1 || height > MAX_DIMENSION)) {
    const err = new Error('Invalid image height');
    err.statusCode = 400;
    throw err;
  }
}

async function saveCaptureBuffer({ userId, sessionId, buffer, mimeType }) {
  ensureRoot();
  const id = crypto.randomUUID();
  const ext = extForMime(mimeType);
  const rel = path.posix.join(String(userId), String(sessionId), `${id}.${ext}`);
  const abs = path.join(ROOT, userId, sessionId, `${id}.${ext}`);
  await fsp.mkdir(path.dirname(abs), { recursive: true, mode: 0o700 });
  await fsp.writeFile(abs, buffer, { mode: 0o600 });
  return { storageKey: rel, absPath: abs, byteSize: buffer.length };
}

function assertRecordingUpload({ mimetype, size }) {
  if (!ALLOWED_RECORDING_MIME.has(String(mimetype || '').toLowerCase())) {
    const err = new Error('Only WebM or MP4 recordings are allowed');
    err.statusCode = 400;
    throw err;
  }
  if (!size || size <= 0 || size > MAX_RECORDING_BYTES) {
    const err = new Error(`Recording must be between 1 byte and ${MAX_RECORDING_BYTES} bytes`);
    err.statusCode = 400;
    throw err;
  }
}

async function saveRecordingBuffer({ userId, sessionId, buffer, mimeType }) {
  ensureRoot();
  const id = crypto.randomUUID();
  const ext = String(mimeType || '').includes('mp4') ? 'mp4' : 'webm';
  const folder = sessionId ? String(sessionId) : 'recordings';
  const rel = path.posix.join(String(userId), folder, `${id}.${ext}`);
  const abs = path.join(ROOT, userId, folder, `${id}.${ext}`);
  await fsp.mkdir(path.dirname(abs), { recursive: true, mode: 0o700 });
  await fsp.writeFile(abs, buffer, { mode: 0o600 });
  return { storageKey: rel, absPath: abs, byteSize: buffer.length };
}

function resolveStorageKey(storageKey) {
  const safe = path.normalize(String(storageKey || '')).replace(/^(\.\.(\/|\\|$))+/, '');
  const abs = path.join(ROOT, safe);
  if (!abs.startsWith(ROOT)) {
    const err = new Error('Invalid storage key');
    err.statusCode = 400;
    throw err;
  }
  return abs;
}

async function readCaptureFile(storageKey) {
  const abs = resolveStorageKey(storageKey);
  return fsp.readFile(abs);
}

async function deleteCaptureFile(storageKey) {
  try {
    const abs = resolveStorageKey(storageKey);
    await fsp.unlink(abs);
  } catch {
    // ignore missing
  }
}

function signAccessToken({ screenshotId, recordingId, adminId }, expiresIn = '5m') {
  return jwt.sign(
    {
      purpose: 'capture_access',
      screenshotId: screenshotId || null,
      recordingId: recordingId || null,
      adminId,
    },
    env.jwt.secret,
    { expiresIn }
  );
}

function verifyAccessToken(token) {
  const decoded = jwt.verify(token, env.jwt.secret);
  if (decoded.purpose !== 'capture_access' || (!decoded.screenshotId && !decoded.recordingId)) {
    const err = new Error('Invalid access token');
    err.statusCode = 401;
    throw err;
  }
  return decoded;
}

module.exports = {
  ROOT,
  MAX_BYTES,
  MAX_RECORDING_BYTES,
  dayKeyFrom,
  assertImageUpload,
  assertRecordingUpload,
  saveCaptureBuffer,
  saveRecordingBuffer,
  readCaptureFile,
  deleteCaptureFile,
  signAccessToken,
  verifyAccessToken,
};
