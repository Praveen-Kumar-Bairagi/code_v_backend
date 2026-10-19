'use strict';

const crypto = require('crypto');
require('dotenv').config();

const PREFIX = 'enc:v1:';
const UNREADABLE = '[Message unavailable]';

let cachedKey = null;

/** CHAT_ENCRYPTION_KEY: 32 bytes as 64 hex chars or base64. Losing it makes stored chats unreadable. */
function getKey() {
  if (cachedKey) return cachedKey;
  const raw = String(process.env.CHAT_ENCRYPTION_KEY || '').trim();
  if (raw) {
    const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
    if (key.length !== 32) throw new Error('CHAT_ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64)');
    cachedKey = key;
  } else {
    console.warn('[chat-crypto] CHAT_ENCRYPTION_KEY not set; deriving key from JWT_SECRET');
    const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
    cachedKey = crypto.createHash('sha256').update(`compameet-chat:${secret}`).digest();
  }
  return cachedKey;
}

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

function encryptText(value) {
  if (value == null || typeof value !== 'string' || isEncrypted(value)) return value;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${data.toString('base64')}`;
}

/** Plain (pre-encryption) rows are returned unchanged. */
function decryptText(value) {
  if (!isEncrypted(value)) return value;
  try {
    const [iv, tag, data] = value.slice(PREFIX.length).split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return UNREADABLE;
  }
}

module.exports = { encryptText, decryptText, isEncrypted };
