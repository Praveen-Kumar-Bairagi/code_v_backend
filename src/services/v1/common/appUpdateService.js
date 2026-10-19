'use strict';

const { PlatformSetting } = require('../../../models');
const AppError = require('../../../utils/AppError');

const SETTING_KEY = 'app_update_config';
const PLATFORMS = ['android', 'ios'];
const VERSION_RE = /^\d+(\.\d+){0,3}$/;

const DEFAULTS = {
  title: 'Update required',
  message: 'A new version of CompaMeet is available. Please update to continue using the app.',
  android: {
    latestVersion: '',
    minVersion: '',
    forceUpdate: false,
    updateUrl: 'https://play.google.com/store/apps/details?id=com.compameet.app',
  },
  ios: {
    latestVersion: '',
    minVersion: '',
    forceUpdate: false,
    updateUrl: '',
  },
};

/** -1 if a < b, 0 if equal, 1 if a > b. Missing segments count as 0 ("1.2" == "1.2.0"). */
function compareVersions(a, b) {
  const pa = String(a).split('.').map((n) => Number(n) || 0);
  const pb = String(b).split('.').map((n) => Number(n) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

async function getConfig() {
  const row = await PlatformSetting.findByPk(SETTING_KEY);
  let stored = {};
  if (row?.value) {
    try {
      const parsed = JSON.parse(row.value);
      if (parsed && typeof parsed === 'object') stored = parsed;
    } catch {
      stored = {};
    }
  }
  return {
    title: stored.title || DEFAULTS.title,
    message: stored.message || DEFAULTS.message,
    android: { ...DEFAULTS.android, ...(stored.android || {}) },
    ios: { ...DEFAULTS.ios, ...(stored.ios || {}) },
    updatedAt: stored.updatedAt || null,
  };
}

function normalizeVersion(value, label) {
  const v = String(value ?? '').trim();
  if (!v) return '';
  if (!VERSION_RE.test(v)) throw new AppError(`${label} must look like 1.0.7`, 400);
  return v;
}

function normalizePlatform(input, current, platform) {
  const src = input && typeof input === 'object' ? input : {};
  const next = { ...current };
  if (src.latestVersion !== undefined) {
    next.latestVersion = normalizeVersion(src.latestVersion, `${platform} latest version`);
  }
  if (src.minVersion !== undefined) {
    next.minVersion = normalizeVersion(src.minVersion, `${platform} minimum version`);
  }
  if (src.forceUpdate !== undefined) {
    next.forceUpdate = src.forceUpdate === true || src.forceUpdate === 'true';
  }
  if (src.updateUrl !== undefined) {
    const url = String(src.updateUrl || '').trim();
    if (url && !/^https?:\/\//i.test(url)) {
      throw new AppError(`${platform} update link must start with http:// or https://`, 400);
    }
    next.updateUrl = url;
  }
  if (next.latestVersion && next.minVersion && compareVersions(next.minVersion, next.latestVersion) > 0) {
    throw new AppError(`${platform} minimum version cannot be higher than the latest version`, 400);
  }
  if (next.forceUpdate && !next.latestVersion) {
    throw new AppError(`Set the ${platform} latest version before forcing an update`, 400);
  }
  return next;
}

async function updateConfig(payload = {}) {
  const current = await getConfig();
  const next = {
    title: payload.title !== undefined ? String(payload.title).trim() || DEFAULTS.title : current.title,
    message:
      payload.message !== undefined ? String(payload.message).trim() || DEFAULTS.message : current.message,
    android: normalizePlatform(payload.android, current.android, 'android'),
    ios: normalizePlatform(payload.ios, current.ios, 'ios'),
    updatedAt: new Date().toISOString(),
  };
  await PlatformSetting.upsert({ key: SETTING_KEY, value: JSON.stringify(next) });
  return next;
}

/**
 * Update status for an installed app build.
 * `forceUpdate` is true when the build is below `minVersion`, or when the admin
 * has switched on force-update and the build is below `latestVersion`.
 */
async function checkVersion({ platform, version } = {}) {
  const key = PLATFORMS.includes(platform) ? platform : 'android';
  const config = await getConfig();
  const p = config[key];
  const current = String(version || '').trim();

  let updateAvailable = false;
  let forceUpdate = false;
  if (current && VERSION_RE.test(current)) {
    updateAvailable = !!p.latestVersion && compareVersions(current, p.latestVersion) < 0;
    const belowMin = !!p.minVersion && compareVersions(current, p.minVersion) < 0;
    forceUpdate = belowMin || (p.forceUpdate && updateAvailable);
  }

  return {
    platform: key,
    currentVersion: current || null,
    latestVersion: p.latestVersion || null,
    minVersion: p.minVersion || null,
    updateAvailable: updateAvailable || forceUpdate,
    forceUpdate,
    updateUrl: p.updateUrl || null,
    title: config.title,
    message: config.message,
  };
}

module.exports = { getConfig, updateConfig, checkVersion, compareVersions };
