'use strict';

const { Op } = require('sequelize');
const { ExpoPushToken } = require('../../../models');
const AppError = require('../../../utils/AppError');

const EXPO_TOKEN_RE = /^ExponentPushToken\[.+\]$/;

function assertValidExpoToken(token) {
  const value = String(token || '').trim();
  if (!EXPO_TOKEN_RE.test(value)) {
    throw new AppError('Invalid Expo push token format', 400);
  }
  return value;
}

async function deactivateOtherSessionTokens(sessionId, keepToken) {
  if (!sessionId || !keepToken) return;
  await ExpoPushToken.update(
    { disabledAt: new Date() },
    {
      where: {
        deviceSessionId: sessionId,
        disabledAt: null,
        token: { [Op.ne]: keepToken },
      },
    }
  );
}

async function registerPushToken(userId, sessionId, { token, platform }) {
  const normalized = assertValidExpoToken(token);
  const now = new Date();
  const platformValue = platform ? String(platform).slice(0, 20) : null;

  const existing = await ExpoPushToken.findOne({ where: { token: normalized } });

  if (existing) {
    existing.userId = userId;
    existing.deviceSessionId = sessionId || existing.deviceSessionId;
    existing.platform = platformValue;
    existing.disabledAt = null;
    existing.lastRegisteredAt = now;
    await existing.save();
    await deactivateOtherSessionTokens(
      sessionId || existing.deviceSessionId,
      normalized
    );
    return existing;
  }

  const row = await ExpoPushToken.create({
    userId,
    deviceSessionId: sessionId || null,
    token: normalized,
    platform: platformValue,
    disabledAt: null,
    lastRegisteredAt: now,
  });
  await deactivateOtherSessionTokens(sessionId, normalized);
  return row;
}

async function unregisterPushToken(userId, token, sessionId) {
  if (token) {
    const normalized = assertValidExpoToken(token);
    const row = await ExpoPushToken.findOne({
      where: { token: normalized, userId },
    });
    if (!row) {
      return { removed: false };
    }
    row.disabledAt = new Date();
    await row.save();
    return { removed: true };
  }

  if (sessionId) {
    const [count] = await ExpoPushToken.update(
      { disabledAt: new Date() },
      { where: { userId, deviceSessionId: sessionId, disabledAt: null } }
    );
    return { removed: count > 0 };
  }

  return { removed: false };
}

async function listActiveTokensForUser(userId) {
  return ExpoPushToken.findAll({
    where: { userId, disabledAt: null },
    order: [['lastRegisteredAt', 'DESC']],
  });
}

async function disableTokens(tokens = []) {
  const list = Array.isArray(tokens) ? tokens.filter(Boolean) : [];
  if (!list.length) return;
  await ExpoPushToken.update(
    { disabledAt: new Date() },
    { where: { token: list, disabledAt: null } }
  );
}

module.exports = {
  registerPushToken,
  unregisterPushToken,
  listActiveTokensForUser,
  disableTokens,
};
