'use strict';

const { User } = require('../../../models');
const AppError = require('../../../utils/AppError');

/** Every setting is a boolean; anything missing falls back to these. */
const DEFAULT_SETTINGS = {
  hideDistance: false,
  hideReadReceipts: false,
  hideTyping: false,
  hideWork: false,
  hideLifestyle: false,
  pauseProfile: false,
  pushEnabled: true,
  pushChat: true,
  pushLikes: true,
  pushPlans: true,
};

function resolveSettings(raw) {
  const stored = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
    out[key] = typeof stored[key] === 'boolean' ? stored[key] : def;
  }
  return out;
}

/** Settings of a loaded user row/JSON (needs the `settings` attribute). */
function settingsOf(user) {
  const json = user && user.toJSON ? user.toJSON() : user || {};
  return resolveSettings(json.settings);
}

async function getSettings(userId) {
  const user = await User.findByPk(userId, { attributes: ['id', 'hideAge', 'settings'] });
  if (!user) throw new AppError('User not found', 404);
  return { hideAge: !!user.hideAge, ...settingsOf(user) };
}

async function updateSettings(userId, body = {}) {
  const user = await User.findByPk(userId, { attributes: ['id', 'hideAge', 'settings'] });
  if (!user) throw new AppError('User not found', 404);

  const next = settingsOf(user);
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (Object.prototype.hasOwnProperty.call(body, key)) next[key] = Boolean(body[key]);
  }
  const patch = { settings: next };
  if (Object.prototype.hasOwnProperty.call(body, 'hideAge')) patch.hideAge = Boolean(body.hideAge);

  await user.update(patch);
  return { hideAge: !!user.hideAge, ...next };
}

/** Which push switch controls a notification type (null = only the master switch). */
function pushKeyForType(type) {
  const t = String(type || '').toLowerCase();
  if (t === 'chat_message' || t === 'new_message') return 'pushChat';
  if (t === 'like' || t === 'match' || t === 'plan_interest') return 'pushLikes';
  if (t === 'plan_new') return 'pushPlans';
  return null;
}

async function wantsPush(userId, type) {
  const user = await User.findByPk(userId, { attributes: ['id', 'settings'] });
  if (!user) return false;
  const s = settingsOf(user);
  if (!s.pushEnabled) return false;
  const key = pushKeyForType(type);
  return key ? s[key] : true;
}

module.exports = {
  DEFAULT_SETTINGS,
  resolveSettings,
  settingsOf,
  getSettings,
  updateSettings,
  wantsPush,
};
