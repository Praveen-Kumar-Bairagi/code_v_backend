'use strict';

const { Op } = require('sequelize');
const { E2eeDeviceKey } = require('../../../models');
const AppError = require('../../../utils/AppError');

const DEVICE_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const MAX_DEVICES_PER_USER = 10;
const KEY_BYTES = 32;
const NONCE_BYTES = 24;
// secretbox adds 16 bytes; 4000 chars of UTF-8 is at most 16000 bytes.
const MAX_CIPHERTEXT_BYTES = 16000 + 16;
const WRAPPED_KEY_BYTES = KEY_BYTES + 16;

function b64Bytes(value) {
  if (typeof value !== 'string' || !value || value.length % 4 !== 0 || !B64_RE.test(value)) return -1;
  const pad = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return (value.length / 4) * 3 - pad;
}

async function registerDeviceKey(userId, { deviceId, publicKey } = {}) {
  const id = String(deviceId || '');
  if (!DEVICE_ID_RE.test(id)) throw new AppError('Invalid device id', 400);
  if (b64Bytes(publicKey) !== KEY_BYTES) throw new AppError('Invalid public key', 400);

  const existing = await E2eeDeviceKey.findOne({ where: { userId, deviceId: id } });
  if (existing) {
    await existing.update({ publicKey, lastSeenAt: new Date() });
  } else {
    await E2eeDeviceKey.create({ userId, deviceId: id, publicKey, lastSeenAt: new Date() });
    const stale = await E2eeDeviceKey.findAll({
      where: { userId },
      order: [['lastSeenAt', 'DESC']],
      offset: MAX_DEVICES_PER_USER,
      attributes: ['id'],
    });
    if (stale.length) {
      await E2eeDeviceKey.destroy({ where: { id: { [Op.in]: stale.map((r) => r.id) } } });
    }
  }
  return { deviceId: id, publicKey };
}

/** Public keys of every registered device of the given users, grouped by user id. */
async function keysForUsers(userIds) {
  const rows = await E2eeDeviceKey.findAll({
    where: { userId: { [Op.in]: userIds } },
    attributes: ['userId', 'deviceId', 'publicKey'],
    order: [['lastSeenAt', 'DESC']],
  });
  const out = Object.fromEntries(userIds.map((uid) => [String(uid), []]));
  rows.forEach((r) => {
    out[String(r.userId)]?.push({ deviceId: r.deviceId, publicKey: r.publicKey });
  });
  return out;
}

/**
 * Checks the shape of a client-built envelope. The server can't decrypt it; it only makes sure the
 * sender device is really one of the sender's registered keys and that sizes are sane.
 * Envelope: { v: 1, sd: senderDeviceId, spk: senderPublicKey, n, c, k: { deviceId: { n, c } } }
 */
async function validateEnvelope(senderId, envelope) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    throw new AppError('Invalid encrypted message', 400);
  }
  const { v, sd, spk, n, c, k } = envelope;
  const bad = () => new AppError('Invalid encrypted message', 400);
  if (v !== 1 || !DEVICE_ID_RE.test(String(sd || ''))) throw bad();
  if (b64Bytes(spk) !== KEY_BYTES || b64Bytes(n) !== NONCE_BYTES) throw bad();
  const cBytes = b64Bytes(c);
  if (cBytes < 17 || cBytes > MAX_CIPHERTEXT_BYTES) throw bad();
  if (!k || typeof k !== 'object' || Array.isArray(k)) throw bad();
  const entries = Object.entries(k);
  if (!entries.length || entries.length > MAX_DEVICES_PER_USER * 2) throw bad();
  for (const [deviceId, wrap] of entries) {
    if (!DEVICE_ID_RE.test(deviceId) || !wrap || typeof wrap !== 'object') throw bad();
    if (b64Bytes(wrap.n) !== NONCE_BYTES || b64Bytes(wrap.c) !== WRAPPED_KEY_BYTES) throw bad();
  }

  const senderKey = await E2eeDeviceKey.findOne({ where: { userId: senderId, deviceId: sd } });
  if (!senderKey || senderKey.publicKey !== spk) {
    const err = new AppError('This device is not registered for encrypted chat', 409);
    err.code = 'E2EE_DEVICE_UNKNOWN';
    throw err;
  }
  return {
    v: 1,
    sd,
    spk,
    n,
    c,
    k: Object.fromEntries(entries.map(([deviceId, wrap]) => [deviceId, { n: wrap.n, c: wrap.c }])),
  };
}

module.exports = { registerDeviceKey, keysForUsers, validateEnvelope, MAX_DEVICES_PER_USER };
