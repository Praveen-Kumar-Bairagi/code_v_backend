'use strict';

const { CoinPack, CoinTransaction, PlatformSetting, User, sequelize } = require('../../../models');
const AppError = require('../../../utils/AppError');

const COIN_TX_TYPES = {
  SIGNUP_BONUS: 'signup_bonus',
  PLAN_POST: 'plan_post',
  SUBSCRIPTION_BONUS: 'subscription_bonus',
  PURCHASE: 'purchase',
  ADMIN_ADJUST: 'admin_adjust',
  VOUCHER: 'voucher',
};

const SETTING_DEFAULTS = {
  'coins.planPostCost': 10,
  'coins.signupBonus': 50,
};

async function getCoinSettings() {
  const rows = await PlatformSetting.findAll({ where: { key: Object.keys(SETTING_DEFAULTS) } });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const read = (key) => {
    const n = Math.round(Number(byKey.get(key)));
    return Number.isFinite(n) && n >= 0 ? n : SETTING_DEFAULTS[key];
  };
  return {
    planPostCost: read('coins.planPostCost'),
    signupBonus: read('coins.signupBonus'),
  };
}

async function updateCoinSettings(body = {}) {
  const updates = [
    ['coins.planPostCost', body.planPostCost],
    ['coins.signupBonus', body.signupBonus],
  ];
  for (const [key, raw] of updates) {
    if (raw === undefined) continue;
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n) || n < 0 || n > 100000) {
      throw new AppError('Coin values must be whole numbers between 0 and 100000', 400);
    }
    await PlatformSetting.upsert({ key, value: String(n) });
  }
  return getCoinSettings();
}

function formatTx(row) {
  const json = row.toJSON ? row.toJSON() : row;
  return {
    id: json.id,
    type: json.type,
    amount: json.amount,
    balanceAfter: json.balanceAfter,
    title: json.title,
    createdAt: json.createdAt,
  };
}

/**
 * Applies a signed coin change. Idempotent when idempotencyKey is given.
 * Debits fail with 402 INSUFFICIENT_COINS instead of going negative.
 */
async function applyChange(
  userId,
  { amount, type, title, referenceId = null, idempotencyKey = null, meta = null },
  { transaction } = {}
) {
  const run = async (t) => {
    if (idempotencyKey) {
      const existing = await CoinTransaction.findOne({ where: { idempotencyKey }, transaction: t });
      if (existing) return existing;
    }
    const user = await User.findByPk(userId, {
      attributes: ['id', 'coinBalance'],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!user) throw new AppError('User not found', 404);
    const next = (user.coinBalance || 0) + amount;
    if (next < 0) {
      throw new AppError(
        `You need ${-amount} coins for this. You have ${user.coinBalance || 0}.`,
        402,
        'INSUFFICIENT_COINS'
      );
    }
    await user.update({ coinBalance: next }, { transaction: t });
    return CoinTransaction.create(
      { userId, type, amount, balanceAfter: next, title, referenceId, idempotencyKey, meta },
      { transaction: t }
    );
  };
  return transaction ? run(transaction) : sequelize.transaction(run);
}

async function grantSignupBonus(userId, { transaction } = {}) {
  const { signupBonus } = await getCoinSettings();
  if (!signupBonus) return null;
  return applyChange(
    userId,
    {
      amount: signupBonus,
      type: COIN_TX_TYPES.SIGNUP_BONUS,
      title: 'Welcome bonus',
      idempotencyKey: `signup_bonus:${userId}`,
    },
    { transaction }
  );
}

async function getWallet(userId, { limit = 30 } = {}) {
  const [user, rows, settings] = await Promise.all([
    User.findByPk(userId, { attributes: ['id', 'coinBalance'] }),
    CoinTransaction.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit: Math.min(Math.max(Number(limit) || 30, 1), 100),
    }),
    getCoinSettings(),
  ]);
  if (!user) throw new AppError('User not found', 404);
  return {
    balance: user.coinBalance || 0,
    planPostCost: settings.planPostCost,
    transactions: rows.map(formatTx),
  };
}

function formatPack(row) {
  const json = row.toJSON ? row.toJSON() : row;
  return {
    id: json.id,
    name: json.name,
    coins: json.coins,
    priceRupees: json.priceRupees,
    tagline: json.tagline || null,
    isActive: json.isActive,
    sortOrder: json.sortOrder,
  };
}

async function listPacks({ activeOnly = true } = {}) {
  const rows = await CoinPack.findAll({
    where: activeOnly ? { isActive: true } : {},
    order: [
      ['sortOrder', 'ASC'],
      ['priceRupees', 'ASC'],
    ],
  });
  return rows.map(formatPack);
}

async function resolvePackForPurchase(packId) {
  const pack = packId ? await CoinPack.findByPk(String(packId)) : null;
  if (!pack || !pack.isActive) throw new AppError('Coin pack not available', 404);
  return pack;
}

function packFields(body, { partial }) {
  const out = {};
  if (!partial || body.name !== undefined) {
    const name = String(body.name || '').trim();
    if (!name) throw new AppError('Pack name is required', 400);
    out.name = name.slice(0, 80);
  }
  if (!partial || body.coins !== undefined) {
    const coins = Math.round(Number(body.coins));
    if (!Number.isFinite(coins) || coins < 1) throw new AppError('Coins must be at least 1', 400);
    out.coins = coins;
  }
  if (!partial || body.priceRupees !== undefined) {
    const price = Math.round(Number(body.priceRupees));
    if (!Number.isFinite(price) || price < 1) throw new AppError('Price must be at least ₹1', 400);
    out.priceRupees = price;
  }
  if (body.tagline !== undefined) out.tagline = body.tagline ? String(body.tagline).slice(0, 160) : null;
  if (body.isActive !== undefined) out.isActive = body.isActive !== false && body.isActive !== 'false';
  if (body.sortOrder !== undefined) out.sortOrder = Number(body.sortOrder) || 0;
  return out;
}

async function createPack(body = {}) {
  return formatPack(await CoinPack.create(packFields(body, { partial: false })));
}

async function updatePack(id, body = {}) {
  const pack = await CoinPack.findByPk(id);
  if (!pack) throw new AppError('Coin pack not found', 404);
  await pack.update(packFields(body, { partial: true }));
  return formatPack(pack);
}

async function deletePack(id) {
  const pack = await CoinPack.findByPk(id);
  if (!pack) throw new AppError('Coin pack not found', 404);
  await pack.destroy();
  return { id };
}

module.exports = {
  COIN_TX_TYPES,
  getCoinSettings,
  updateCoinSettings,
  applyChange,
  grantSignupBonus,
  getWallet,
  listPacks,
  resolvePackForPurchase,
  createPack,
  updatePack,
  deletePack,
};
