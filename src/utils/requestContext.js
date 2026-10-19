'use strict';

const { AsyncLocalStorage } = require('async_hooks');

const storage = new AsyncLocalStorage();

/** Express middleware: makes the caller's IP available to services without passing `req` around. */
function requestContextMiddleware(req, res, next) {
  storage.run({ ip: normalizeIp(req.ip || req.socket?.remoteAddress) }, next);
}

function normalizeIp(ip) {
  if (!ip) return null;
  const value = String(ip).replace(/^::ffff:/, '');
  return value.slice(0, 64) || null;
}

function currentIp() {
  return storage.getStore()?.ip || null;
}

module.exports = { requestContextMiddleware, currentIp };
