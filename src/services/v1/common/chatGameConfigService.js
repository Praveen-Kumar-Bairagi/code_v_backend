'use strict';

const { PlatformSetting } = require('../../../models');
const AppError = require('../../../utils/AppError');
const { GAMES, TIER_LABELS, tierRank } = require('../../../content/chatGames');

const SETTING_KEY = 'chat_games_config';
const TIERS = ['chat', 'connect', 'plus'];

async function readOverrides() {
  const row = await PlatformSetting.findByPk(SETTING_KEY);
  if (!row?.value) return {};
  try {
    const parsed = JSON.parse(row.value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** All games with admin overrides (tier + isActive) applied. */
async function listConfiguredGames() {
  const overrides = await readOverrides();
  return GAMES.map((g) => {
    const o = overrides[g.id] || {};
    const tier = TIERS.includes(o.tier) ? o.tier : g.tier;
    return { ...g, tier, defaultTier: g.tier, isActive: o.isActive !== false };
  });
}

async function listActiveGames() {
  return (await listConfiguredGames()).filter((g) => g.isActive);
}

/** Active game titles included in a plan tier (lower tiers' games are included too). */
async function gamesByTier() {
  const games = await listActiveGames();
  const out = {};
  for (const tier of TIERS) {
    out[tier] = games
      .filter((g) => tierRank(g.tier) <= tierRank(tier))
      .map((g) => ({ id: g.id, title: g.title, emoji: g.emoji }));
  }
  return out;
}

async function adminList() {
  const games = await listConfiguredGames();
  return {
    tiers: TIERS.map((t) => ({ value: t, label: TIER_LABELS[t] })),
    games: games.map((g) => ({
      id: g.id,
      title: g.title,
      emoji: g.emoji,
      description: g.description,
      tier: g.tier,
      tierLabel: TIER_LABELS[g.tier],
      defaultTier: g.defaultTier,
      isActive: g.isActive,
    })),
  };
}

async function adminUpdate(gameId, payload = {}) {
  if (!GAMES.some((g) => g.id === gameId)) throw new AppError('Game not found', 404);
  const overrides = await readOverrides();
  const next = { ...(overrides[gameId] || {}) };
  if (payload.tier !== undefined) {
    if (!TIERS.includes(payload.tier)) throw new AppError('Invalid plan tier', 400);
    next.tier = payload.tier;
  }
  if (payload.isActive !== undefined) {
    next.isActive = payload.isActive === true || payload.isActive === 'true';
  }
  overrides[gameId] = next;
  await PlatformSetting.upsert({ key: SETTING_KEY, value: JSON.stringify(overrides) });
  return adminList();
}

module.exports = { listConfiguredGames, listActiveGames, gamesByTier, adminList, adminUpdate };
