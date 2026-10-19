'use strict';

const { Op } = require('sequelize');
const {
  SubscriptionPlan,
  Subscription,
  User,
  sequelize,
} = require('../../../models');
const AppError = require('../../../utils/AppError');
const walletService = require('./walletService');
const coinService = require('./coinService');
const { gamesByTier } = require('../common/chatGameConfigService');

const PLAN_TIERS = ['chat', 'connect', 'plus'];

function parseTier(value) {
  const tier = String(value || '').trim().toLowerCase();
  if (!PLAN_TIERS.includes(tier)) throw new AppError('Tier must be chat, connect or plus', 400);
  return tier;
}

function parseBonusCoins(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0) throw new AppError('Bonus coins must be 0 or more', 400);
  return n;
}

const FALLBACK_PLANS = [
  {
    id: 'fallback-monthly',
    name: 'Chat',
    priceRupees: 199,
    durationDays: 30,
    sortOrder: 10,
    tagline: 'Mutual chat access',
    bonusCoins: 150,
    tier: 'chat',
  },
  {
    id: 'fallback-connect',
    name: 'Connect',
    priceRupees: 499,
    durationDays: 90,
    sortOrder: 12,
    tagline: 'Chat + conversation games',
    bonusCoins: 150,
    tier: 'connect',
  },
  {
    id: 'fallback-plus',
    name: 'Plus',
    priceRupees: 699,
    durationDays: 180,
    sortOrder: 14,
    tagline: 'Chat + all games & ice-breakers',
    bonusCoins: 150,
    tier: 'plus',
  },
];

function formatPlan(row) {
  if (row.toPublicJSON) return row.toPublicJSON();
  return {
    id: row.id,
    name: row.name,
    priceRupees: row.priceRupees,
    durationDays: row.durationDays,
    isActive: row.isActive !== false,
    sortOrder: row.sortOrder ?? 0,
    tagline: row.tagline || null,
    bonusCoins: row.bonusCoins ?? 0,
    tier: row.tier || 'chat',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function formatSubscription(row) {
  const plain = row.toJSON ? row.toJSON() : row;
  const active =
    plain.status === 'active' &&
    plain.expiresAt &&
    new Date(plain.expiresAt).getTime() > Date.now();
  const u = plain.user;
  const subscriberName = u
    ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || null
    : null;
  let role = 'user';
  if (u) {
    const companion = !!u.hasCompanionProfile;
    const seeker = u.hasUserProfile !== false;
    if (companion && !seeker) role = 'companion';
  }
  let remainingDays = 0;
  if (plain.expiresAt && active) {
    remainingDays = Math.max(
      0,
      Math.ceil((new Date(plain.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    );
  }
  return {
    id: plain.id,
    userId: plain.userId,
    subscriberId: plain.userId,
    subscriberName,
    subscriberMobile: u?.mobileNumber || null,
    role,
    planId: plain.planId,
    planName: plain.planName,
    priceRupees: plain.priceRupees,
    durationDays: plain.durationDays,
    startedAt: plain.startedAt,
    expiresAt: plain.expiresAt,
    status: active ? 'active' : plain.status === 'active' ? 'expired' : plain.status,
    isActive: active,
    remainingDays,
    paymentMethod: plain.paymentMethod || null,
    createdAt: plain.createdAt,
    user: u
      ? {
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          mobileNumber: u.mobileNumber,
        }
      : undefined,
  };
}

async function listPlans({ activeOnly = false } = {}) {
  const where = activeOnly ? { isActive: true } : {};
  const rows = await SubscriptionPlan.findAll({
    where,
    order: [
      ['sortOrder', 'ASC'],
      ['priceRupees', 'ASC'],
    ],
  });
  return rows.map(formatPlan);
}

async function listPublicPlans() {
  const plans = await listPlans({ activeOnly: true });
  const byTier = await gamesByTier();
  const items = (plans.length ? plans : FALLBACK_PLANS).map((p) => ({
    ...p,
    games: byTier[p.tier || 'chat'] || [],
  }));
  // Single catalog for unified user+companion account
  return { plans: items, user: items, companion: items };
}

async function createPlan(payload) {
  const name = String(payload.name || '').trim();
  if (!name) throw new AppError('Plan name is required', 400);
  const priceRupees = Math.round(Number(payload.priceRupees));
  if (!Number.isFinite(priceRupees) || priceRupees < 1) {
    throw new AppError('Plan price must be at least ₹1', 400);
  }
  const durationDays = Math.round(Number(payload.durationDays));
  if (!Number.isFinite(durationDays) || durationDays < 1) {
    throw new AppError('Duration must be at least 1 day', 400);
  }
  const plan = await SubscriptionPlan.create({
    name,
    priceRupees,
    durationDays,
    isActive: payload.isActive !== false && payload.isActive !== 'false',
    sortOrder: Number(payload.sortOrder) || 0,
    tagline: payload.tagline ? String(payload.tagline).slice(0, 160) : null,
    bonusCoins: payload.bonusCoins !== undefined ? parseBonusCoins(payload.bonusCoins) : 0,
    tier: payload.tier !== undefined ? parseTier(payload.tier) : 'chat',
  });
  return formatPlan(plan);
}

async function updatePlan(id, payload) {
  const plan = await SubscriptionPlan.findByPk(id);
  if (!plan) throw new AppError('Subscription plan not found', 404);

  if (payload.name !== undefined) {
    const name = String(payload.name || '').trim();
    if (!name) throw new AppError('Plan name is required', 400);
    plan.name = name;
  }
  if (payload.priceRupees !== undefined) {
    const priceRupees = Math.round(Number(payload.priceRupees));
    if (!Number.isFinite(priceRupees) || priceRupees < 1) {
      throw new AppError('Plan price must be at least ₹1', 400);
    }
    plan.priceRupees = priceRupees;
  }
  if (payload.durationDays !== undefined) {
    const durationDays = Math.round(Number(payload.durationDays));
    if (!Number.isFinite(durationDays) || durationDays < 1) {
      throw new AppError('Duration must be at least 1 day', 400);
    }
    plan.durationDays = durationDays;
  }
  if (payload.isActive !== undefined) {
    plan.isActive = payload.isActive !== false && payload.isActive !== 'false';
  }
  if (payload.sortOrder !== undefined) plan.sortOrder = Number(payload.sortOrder) || 0;
  if (payload.tagline !== undefined) {
    plan.tagline = payload.tagline ? String(payload.tagline).slice(0, 160) : null;
  }
  if (payload.bonusCoins !== undefined) plan.bonusCoins = parseBonusCoins(payload.bonusCoins);
  if (payload.tier !== undefined) plan.tier = parseTier(payload.tier);
  await plan.save();
  return formatPlan(plan);
}

async function getStatus(userId) {
  const row = await Subscription.findOne({
    where: { userId, status: 'active' },
    order: [['expiresAt', 'DESC']],
  });
  if (!row) {
    return {
      isActive: false,
      status: 'none',
      planId: null,
      planName: null,
      expiresAt: null,
      startedAt: null,
    };
  }
  const formatted = formatSubscription(row);
  if (!formatted.isActive) {
    row.status = 'expired';
    await row.save({ fields: ['status'] });
    return {
      isActive: false,
      status: 'expired',
      planId: row.planId,
      planName: row.planName,
      expiresAt: row.expiresAt,
      startedAt: row.startedAt,
    };
  }
  const plan = row.planId ? await SubscriptionPlan.findByPk(row.planId, { attributes: ['tier'] }) : null;
  return {
    isActive: true,
    status: 'active',
    tier: plan?.tier || 'chat',
    planId: row.planId,
    planName: row.planName,
    expiresAt: row.expiresAt,
    startedAt: row.startedAt,
    priceRupees: row.priceRupees,
    durationDays: row.durationDays,
  };
}

async function resolvePlanForPurchase(planId) {
  const id = String(planId || '').trim();
  if (!id) {
    throw new AppError('planId is required', 400);
  }

  let plan = await SubscriptionPlan.findByPk(id);
  if (plan?.isActive) return plan;

  const fallback = FALLBACK_PLANS.find((p) => p.id === id);
  if (fallback) {
    plan = await SubscriptionPlan.findOne({
      where: {
        name: fallback.name,
        durationDays: fallback.durationDays,
        isActive: true,
      },
      order: [['updatedAt', 'DESC']],
    });
    if (plan) return plan;
  }

  throw new AppError('Plan not available', 404);
}

async function purchasePlan(userId, planId) {
  const plan = await resolvePlanForPurchase(planId);

  return sequelize.transaction(async (transaction) => {
    const ledger = await walletService.createLedgerEntry({
      userId,
      type: 'subscription',
      direction: 'debit',
      amount: plan.priceRupees,
      title: `Subscription · ${plan.name}`,
      body: `Paid ₹${plan.priceRupees} for ${plan.durationDays} days`,
      meta: { planId: plan.id, planName: plan.name, withdrawable: false },
      affectsBalance: true,
      transaction,
    });

    return activatePlan(userId, plan, {
      paymentMethod: 'wallet',
      walletTransactionId: ledger.id,
      walletTransaction: ledger,
      transaction,
    });
  });
}

/** Extends from current expiry if a plan is still running. Caller owns the transaction. */
async function activatePlan(
  userId,
  plan,
  { paymentMethod, walletTransactionId = null, walletTransaction = null, transaction }
) {
  const now = new Date();
  const existing = await Subscription.findOne({
    where: {
      userId,
      status: 'active',
      expiresAt: { [Op.gt]: now },
    },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  const startFrom =
    existing && new Date(existing.expiresAt) > now ? new Date(existing.expiresAt) : now;
  const expiresAt = new Date(startFrom.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

  if (existing) {
    existing.status = 'expired';
    await existing.save({ transaction });
  }

  const sub = await Subscription.create(
    {
      userId,
      planId: plan.id,
      planName: plan.name,
      priceRupees: plan.priceRupees,
      durationDays: plan.durationDays,
      startedAt: now,
      expiresAt,
      status: 'active',
      paymentMethod,
      walletTransactionId,
    },
    { transaction }
  );

  const bonusCoins = Number(plan.bonusCoins) || 0;
  if (bonusCoins > 0) {
    await coinService.applyChange(
      userId,
      {
        amount: bonusCoins,
        type: coinService.COIN_TX_TYPES.SUBSCRIPTION_BONUS,
        title: `${plan.name} subscription coins`,
        referenceId: sub.id,
        idempotencyKey: `subscription_bonus:${sub.id}`,
      },
      { transaction }
    );
  }

  return {
    subscription: formatSubscription(sub),
    walletTransaction,
    bonusCoins,
  };
}

async function listPurchases({ status, page = 1, limit = 50 } = {}) {
  const where = {};
  if (status === 'active') {
    where.status = 'active';
    where.expiresAt = { [Op.gt]: new Date() };
  } else if (status === 'expired') {
    where[Op.or] = [
      { status: 'expired' },
      { status: 'active', expiresAt: { [Op.lte]: new Date() } },
    ];
  }

  const take = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const current = Math.max(Number(page) || 1, 1);
  const { rows, count } = await Subscription.findAndCountAll({
    where,
    include: [
      {
        model: User,
        as: 'user',
        attributes: [
          'id',
          'firstName',
          'lastName',
          'mobileNumber',
          'hasUserProfile',
          'hasCompanionProfile',
        ],
      },
    ],
    order: [['createdAt', 'DESC']],
    limit: take,
    offset: (current - 1) * take,
  });

  return {
    items: rows.map(formatSubscription),
    pagination: {
      page: current,
      limit: take,
      total: count,
      totalPages: Math.max(1, Math.ceil(count / take)),
    },
  };
}

module.exports = {
  FALLBACK_PLANS,
  PLAN_TIERS,
  listPlans,
  listPublicPlans,
  createPlan,
  updatePlan,
  getStatus,
  purchasePlan,
  activatePlan,
  resolvePlanForPurchase,
  listPurchases,
};
