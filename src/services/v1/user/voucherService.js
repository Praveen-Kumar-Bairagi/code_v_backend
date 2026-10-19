'use strict';

const { Op } = require('sequelize');
const {
  Voucher,
  VoucherRedemption,
  CoinPack,
  SubscriptionPlan,
  User,
  sequelize,
} = require('../../../models');
const AppError = require('../../../utils/AppError');
const coinService = require('./coinService');
const subscriptionService = require('./subscriptionService');
const { userMatchesAudience } = require('../admin/broadcastService');

const APPLIES_TO = ['coins', 'subscription'];
const KINDS = ['discount', 'reward'];
const DISCOUNT_TYPES = ['percent', 'flat'];
// Razorpay can't charge less than ₹1.
const MIN_CHARGE_RUPEES = 1;

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase().replace(/\s+/g, '');
}

function isLive(voucher, now = new Date()) {
  if (!voucher.isActive) return false;
  if (voucher.startsAt && new Date(voucher.startsAt) > now) return false;
  if (voucher.expiresAt && new Date(voucher.expiresAt) <= now) return false;
  if (voucher.maxRedemptions != null && voucher.redeemedCount >= voucher.maxRedemptions) return false;
  return true;
}

function computeDiscount(voucher, priceRupees) {
  const price = Math.max(0, Math.round(Number(priceRupees) || 0));
  let off = 0;
  if (voucher.discountType === 'percent') {
    off = Math.floor((price * (voucher.discountValue || 0)) / 100);
    if (voucher.maxDiscountRupees) off = Math.min(off, voucher.maxDiscountRupees);
  } else {
    off = voucher.discountValue || 0;
  }
  const finalRupees = Math.max(MIN_CHARGE_RUPEES, price - off);
  return { originalRupees: price, discountRupees: price - finalRupees, finalRupees };
}

function offerLabel(v, targetName) {
  const on = targetName || (v.appliesTo === 'coins' ? 'coin packs' : 'subscriptions');
  if (v.kind === 'reward') {
    return v.appliesTo === 'coins'
      ? `${v.rewardCoins} free coins`
      : `Free ${targetName || 'subscription'} plan`;
  }
  const amount = v.discountType === 'percent' ? `${v.discountValue}% off` : `₹${v.discountValue} off`;
  const cap = v.discountType === 'percent' && v.maxDiscountRupees ? ` (up to ₹${v.maxDiscountRupees})` : '';
  return `${amount}${cap} on ${on}`;
}

async function targetNames(vouchers) {
  const ids = [...new Set(vouchers.map((v) => v.targetId).filter(Boolean))];
  if (!ids.length) return new Map();
  const [packs, plans] = await Promise.all([
    CoinPack.findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id', 'name', 'coins'] }),
    SubscriptionPlan.findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id', 'name'] }),
  ]);
  const map = new Map();
  packs.forEach((p) => map.set(String(p.id), `${p.name} (${p.coins} coins)`));
  plans.forEach((p) => map.set(String(p.id), p.name));
  return map;
}

function formatPublic(v, { targetName = null, usesLeft = null } = {}) {
  return {
    id: v.id,
    code: v.code,
    title: v.title,
    description: v.description || null,
    appliesTo: v.appliesTo,
    kind: v.kind,
    discountType: v.discountType,
    discountValue: v.discountValue,
    maxDiscountRupees: v.maxDiscountRupees,
    targetId: v.targetId,
    targetName,
    rewardCoins: v.rewardCoins,
    expiresAt: v.expiresAt,
    usesLeft,
    offer: offerLabel(v, targetName),
  };
}

async function loadUser(userId) {
  const user = await User.findByPk(userId, { attributes: ['id', 'gender', 'cityId', 'isActive'] });
  if (!user || !user.isActive) throw new AppError('User not found', 404);
  return user;
}

async function usedCount(voucherId, userId, transaction) {
  return VoucherRedemption.count({ where: { voucherId, userId }, transaction });
}

/** Throws a user-facing error when this user can't use the voucher right now. */
async function assertUsable(voucher, user, { transaction } = {}) {
  if (!voucher || !isLive(voucher)) throw new AppError('This voucher is not valid or has expired', 400);
  if (!userMatchesAudience(voucher.audience, user)) {
    throw new AppError('This voucher is not available for your account', 400);
  }
  const used = await usedCount(voucher.id, user.id, transaction);
  if (used >= (voucher.perUserLimit || 1)) {
    throw new AppError('You have already used this voucher', 400);
  }
  return (voucher.perUserLimit || 1) - used;
}

async function findByCode(code, options = {}) {
  const value = normalizeCode(code);
  if (!value) throw new AppError('Enter a voucher code', 400);
  const voucher = await Voucher.findOne({ where: { code: value }, ...options });
  if (!voucher) throw new AppError('Voucher code not found', 404);
  return voucher;
}

async function listForUser(userId, { appliesTo } = {}) {
  const user = await loadUser(userId);
  const now = new Date();
  const where = {
    isActive: true,
    [Op.and]: [
      { [Op.or]: [{ startsAt: null }, { startsAt: { [Op.lte]: now } }] },
      { [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: now } }] },
    ],
  };
  if (APPLIES_TO.includes(appliesTo)) where.appliesTo = appliesTo;
  const rows = (await Voucher.findAll({ where, order: [['createdAt', 'DESC']] })).filter(
    (v) => isLive(v, now) && userMatchesAudience(v.audience, user)
  );
  if (!rows.length) return [];

  const counts = await VoucherRedemption.findAll({
    where: { userId, voucherId: { [Op.in]: rows.map((v) => v.id) } },
    attributes: ['voucherId', [sequelize.fn('COUNT', sequelize.col('id')), 'n']],
    group: ['voucherId'],
    raw: true,
  });
  const usedBy = new Map(counts.map((c) => [String(c.voucherId), Number(c.n)]));
  const names = await targetNames(rows);
  return rows
    .map((v) => ({ v, left: (v.perUserLimit || 1) - (usedBy.get(String(v.id)) || 0) }))
    .filter(({ left }) => left > 0)
    .map(({ v, left }) =>
      formatPublic(v, { targetName: names.get(String(v.targetId)) || null, usesLeft: left })
    );
}

/** A typed code → the voucher (if this user can use it), so the app knows whether to apply or redeem it. */
async function lookup(userId, code) {
  const user = await loadUser(userId);
  const voucher = await findByCode(code);
  const usesLeft = await assertUsable(voucher, user);
  const names = await targetNames([voucher]);
  return formatPublic(voucher, { targetName: names.get(String(voucher.targetId)) || null, usesLeft });
}

/**
 * Validates a discount code for a coin pack / subscription plan and returns the price breakdown.
 * Used by the app's "Apply" button and again when the payment order is created.
 */
async function quoteDiscount(userId, { code, appliesTo, itemId, priceRupees, itemName }) {
  const user = await loadUser(userId);
  const voucher = await findByCode(code);
  await assertUsable(voucher, user);
  if (voucher.kind !== 'discount') {
    throw new AppError('This is a free reward voucher — tap Redeem to claim it', 400);
  }
  if (voucher.appliesTo !== appliesTo) {
    throw new AppError(
      `This voucher works on ${voucher.appliesTo === 'coins' ? 'coin packs' : 'subscriptions'} only`,
      400
    );
  }
  if (voucher.targetId && String(voucher.targetId) !== String(itemId)) {
    const names = await targetNames([voucher]);
    throw new AppError(`This voucher works only on ${names.get(String(voucher.targetId)) || 'another item'}`, 400);
  }
  const breakdown = computeDiscount(voucher, priceRupees);
  return {
    voucherId: voucher.id,
    voucherCode: voucher.code,
    itemName: itemName || null,
    ...breakdown,
  };
}

async function quoteForItem(userId, { code, appliesTo, itemId }) {
  if (appliesTo === 'coins') {
    const pack = await coinService.resolvePackForPurchase(itemId);
    return quoteDiscount(userId, {
      code,
      appliesTo,
      itemId: pack.id,
      priceRupees: pack.priceRupees,
      itemName: `${pack.coins} coins`,
    });
  }
  if (appliesTo === 'subscription') {
    const plan = await subscriptionService.resolvePlanForPurchase(itemId);
    return quoteDiscount(userId, {
      code,
      appliesTo,
      itemId: plan.id,
      priceRupees: plan.priceRupees,
      itemName: plan.name,
    });
  }
  throw new AppError('appliesTo must be coins or subscription', 400);
}

/** Called inside the payment fulfilment transaction once a discounted order is paid. */
async function recordOrderRedemption(order, { transaction }) {
  const meta = order.meta || {};
  if (!meta.voucherId) return null;
  const [row, created] = await VoucherRedemption.findOrCreate({
    where: { paymentOrderId: order.id },
    defaults: {
      voucherId: meta.voucherId,
      userId: order.userId,
      itemName: meta.voucherItemName || null,
      originalRupees: meta.originalAmount ?? null,
      discountRupees: meta.discountRupees || 0,
    },
    transaction,
  });
  if (created) {
    await Voucher.increment('redeemedCount', { by: 1, where: { id: meta.voucherId }, transaction });
  }
  return row;
}

/** Free reward vouchers: grant coins or start the subscription plan, no payment. */
async function redeemReward(userId, code) {
  const user = await loadUser(userId);
  return sequelize.transaction(async (transaction) => {
    const voucher = await findByCode(code, { transaction, lock: transaction.LOCK.UPDATE });
    await assertUsable(voucher, user, { transaction });
    if (voucher.kind !== 'reward') {
      throw new AppError(
        `This is a discount voucher — choose a ${voucher.appliesTo === 'coins' ? 'coin pack' : 'plan'} and apply it at checkout`,
        400
      );
    }

    const redemption = await VoucherRedemption.create(
      { voucherId: voucher.id, userId, discountRupees: 0 },
      { transaction }
    );

    let result;
    if (voucher.appliesTo === 'coins') {
      const coins = voucher.rewardCoins || 0;
      if (coins < 1) throw new AppError('This voucher has no coins configured', 400);
      await coinService.applyChange(
        userId,
        {
          amount: coins,
          type: coinService.COIN_TX_TYPES.VOUCHER,
          title: `Voucher ${voucher.code}`,
          referenceId: redemption.id,
          idempotencyKey: `voucher:${redemption.id}`,
          meta: { voucherId: voucher.id },
        },
        { transaction }
      );
      await redemption.update({ rewardCoins: coins, itemName: `${coins} coins` }, { transaction });
      result = { type: 'coins', coins, message: `${coins} coins added to your balance` };
    } else {
      const plan = voucher.targetId
        ? await SubscriptionPlan.findByPk(voucher.targetId, { transaction })
        : null;
      if (!plan) throw new AppError('The plan for this voucher is no longer available', 400);
      const activated = await subscriptionService.activatePlan(userId, plan, {
        paymentMethod: 'voucher',
        transaction,
      });
      await redemption.update(
        {
          subscriptionId: activated.subscription.id,
          itemName: plan.name,
          originalRupees: plan.priceRupees,
          discountRupees: plan.priceRupees,
          rewardCoins: activated.bonusCoins || 0,
        },
        { transaction }
      );
      result = {
        type: 'subscription',
        planName: plan.name,
        expiresAt: activated.subscription.expiresAt,
        coins: activated.bonusCoins || 0,
        message: `${plan.name} plan activated`,
      };
    }

    await voucher.increment('redeemedCount', { by: 1, transaction });
    return { voucherId: voucher.id, code: voucher.code, ...result };
  });
}

module.exports = {
  APPLIES_TO,
  KINDS,
  DISCOUNT_TYPES,
  normalizeCode,
  isLive,
  computeDiscount,
  offerLabel,
  targetNames,
  listForUser,
  lookup,
  quoteDiscount,
  quoteForItem,
  recordOrderRedemption,
  redeemReward,
};
