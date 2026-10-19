'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const {
  Voucher,
  VoucherRedemption,
  CoinPack,
  SubscriptionPlan,
  City,
  User,
} = require('../../../models');
const AppError = require('../../../utils/AppError');
const voucherService = require('../user/voucherService');
const broadcastService = require('./broadcastService');

const CODE_RE = /^[A-Z0-9_-]{4,30}$/;

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

function int(value, label, { min = 0, max = 1000000, nullable = false } = {}) {
  if (value === undefined) return undefined;
  if (value === null || value === '') {
    if (nullable) return null;
    throw new AppError(`${label} is required`, 400);
  }
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new AppError(`${label} must be between ${min} and ${max}`, 400);
  }
  return n;
}

function date(value, label) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new AppError(`${label} is not a valid date`, 400);
  return d;
}

async function generateCode() {
  for (let i = 0; i < 5; i += 1) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    if (!(await Voucher.count({ where: { code } }))) return code;
  }
  throw new AppError('Could not generate a unique code, try again', 500);
}

/** Validates the benefit part (what the voucher gives). Returns the full set of benefit columns. */
async function benefitFields(src) {
  const appliesTo = String(src.appliesTo || '');
  const kind = String(src.kind || '');
  if (!voucherService.APPLIES_TO.includes(appliesTo)) {
    throw new AppError('Voucher must be for coins or subscription', 400);
  }
  if (!voucherService.KINDS.includes(kind)) throw new AppError('Voucher type must be discount or reward', 400);

  const out = {
    appliesTo,
    kind,
    discountType: null,
    discountValue: null,
    maxDiscountRupees: null,
    rewardCoins: null,
    targetId: src.targetId ? String(src.targetId) : null,
  };

  if (out.targetId) {
    const model = appliesTo === 'coins' ? CoinPack : SubscriptionPlan;
    if (!(await model.findByPk(out.targetId))) {
      throw new AppError(appliesTo === 'coins' ? 'Coin pack not found' : 'Subscription plan not found', 400);
    }
  }

  if (kind === 'discount') {
    if (!voucherService.DISCOUNT_TYPES.includes(src.discountType)) {
      throw new AppError('Discount must be percent or flat ₹', 400);
    }
    out.discountType = src.discountType;
    out.discountValue =
      src.discountType === 'percent'
        ? int(src.discountValue, 'Discount %', { min: 1, max: 100 })
        : int(src.discountValue, 'Discount amount', { min: 1, max: 100000 });
    if (src.discountType === 'percent') {
      out.maxDiscountRupees = int(src.maxDiscountRupees ?? null, 'Max discount', {
        min: 1,
        max: 100000,
        nullable: true,
      });
    }
  } else if (appliesTo === 'coins') {
    out.rewardCoins = int(src.rewardCoins, 'Free coins', { min: 1, max: 100000 });
    out.targetId = null;
  } else if (!out.targetId) {
    throw new AppError('Choose which subscription plan this voucher gives free', 400);
  }
  return out;
}

function audienceFrom(raw) {
  const audience = broadcastService.normalizeAudience(raw || {});
  if (audience.mode === 'selected' && !audience.userIds.length) {
    throw new AppError('Select at least one user', 400);
  }
  return audience;
}

function commonFields(body) {
  const out = {};
  if (body.title !== undefined) {
    const title = String(body.title || '').trim();
    if (!title) throw new AppError('Title is required', 400);
    out.title = title.slice(0, 120);
  }
  if (body.description !== undefined) {
    out.description = String(body.description || '').trim().slice(0, 500) || null;
  }
  if (body.startsAt !== undefined) out.startsAt = date(body.startsAt, 'Start date');
  if (body.expiresAt !== undefined) out.expiresAt = date(body.expiresAt, 'Expiry date');
  if (body.maxRedemptions !== undefined) {
    out.maxRedemptions = int(body.maxRedemptions, 'Total uses', { min: 1, nullable: true });
  }
  if (body.perUserLimit !== undefined) {
    out.perUserLimit = int(body.perUserLimit, 'Uses per user', { min: 1, max: 100 });
  }
  if (body.isActive !== undefined) out.isActive = body.isActive !== false && body.isActive !== 'false';
  if (body.audience !== undefined) out.audience = audienceFrom(body.audience);
  return out;
}

function assertDates(v) {
  if (v.startsAt && v.expiresAt && new Date(v.expiresAt) <= new Date(v.startsAt)) {
    throw new AppError('Expiry must be after the start date', 400);
  }
}

async function cityNameMap(vouchers) {
  const ids = [...new Set(vouchers.flatMap((v) => v.audience?.cityIds || []))];
  if (!ids.length) return new Map();
  const cities = await City.findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id', 'name'] });
  return new Map(cities.map((c) => [String(c.id), c.name]));
}

async function pickedUserMap(vouchers) {
  const ids = [...new Set(vouchers.flatMap((v) => v.audience?.userIds || []))];
  if (!ids.length) return new Map();
  const users = await User.findAll({
    where: { id: { [Op.in]: ids } },
    attributes: ['id', 'firstName', 'lastName', 'mobileNumber'],
  });
  return new Map(
    users.map((u) => [
      String(u.id),
      { id: u.id, name: [u.firstName, u.lastName].filter(Boolean).join(' '), mobileNumber: u.mobileNumber },
    ])
  );
}

function formatAdmin(v, { targetName, cityNames, pickedUsers }) {
  const json = v.toJSON ? v.toJSON() : v;
  return {
    ...json,
    targetName: targetName || null,
    offer: voucherService.offerLabel(json, targetName),
    isLive: voucherService.isLive(json),
    audience: {
      ...json.audience,
      cityNames: (json.audience?.cityIds || []).map((id) => cityNames.get(String(id)) || 'Unknown'),
      users: (json.audience?.userIds || []).map(
        (id) => pickedUsers.get(String(id)) || { id, name: '', mobileNumber: '' }
      ),
    },
  };
}

async function formatMany(rows) {
  const [names, cities, pickedUsers] = await Promise.all([
    voucherService.targetNames(rows),
    cityNameMap(rows),
    pickedUserMap(rows),
  ]);
  return rows.map((v) =>
    formatAdmin(v, { targetName: names.get(String(v.targetId)), cityNames: cities, pickedUsers })
  );
}

function notificationText(voucher, targetName) {
  const offer = voucherService.offerLabel(voucher, targetName);
  const until = voucher.expiresAt
    ? ` Valid till ${new Date(voucher.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.`
    : '';
  return {
    title: `🎁 ${voucher.title}`.slice(0, 100),
    body: `${voucher.description ? `${voucher.description} ` : ''}${offer}. Use code ${voucher.code}.${until}`.slice(0, 500),
  };
}

async function notifyAudience(adminId, voucher) {
  const names = await voucherService.targetNames([voucher]);
  const text = notificationText(voucher, names.get(String(voucher.targetId)));
  try {
    const sent = await broadcastService.sendBroadcast(
      adminId,
      { ...text, audience: voucher.audience },
      { type: 'voucher', data: { voucherId: voucher.id, appliesTo: voucher.appliesTo } }
    );
    return { sent: true, recipients: sent.expectedRecipients };
  } catch (err) {
    return { sent: false, message: err.message };
  }
}

async function list(query = {}) {
  const { page, limit, offset } = parsePagination(query);
  const where = {};
  const search = String(query.search || '').trim();
  if (search) {
    where[Op.or] = [
      { code: { [Op.iLike]: `%${search}%` } },
      { title: { [Op.iLike]: `%${search}%` } },
    ];
  }
  if (voucherService.APPLIES_TO.includes(query.appliesTo)) where.appliesTo = query.appliesTo;
  const { rows, count } = await Voucher.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });
  const [items, packs, plans] = await Promise.all([
    formatMany(rows),
    CoinPack.findAll({ attributes: ['id', 'name', 'coins', 'priceRupees', 'isActive'], order: [['priceRupees', 'ASC']] }),
    SubscriptionPlan.findAll({
      attributes: ['id', 'name', 'priceRupees', 'durationDays', 'isActive'],
      order: [['priceRupees', 'ASC']],
    }),
  ]);
  return {
    items,
    options: { coinPacks: packs, subscriptionPlans: plans },
    pagination: { page, limit, total: count, totalPages: count === 0 ? 0 : Math.ceil(count / limit) },
  };
}

async function create(adminId, body = {}) {
  let code = voucherService.normalizeCode(body.code);
  if (code) {
    if (!CODE_RE.test(code)) {
      throw new AppError('Code must be 4–30 letters, numbers, - or _', 400);
    }
    if (await Voucher.count({ where: { code } })) throw new AppError('This code already exists', 400);
  } else {
    code = await generateCode();
  }

  const fields = {
    ...commonFields({ audience: body.audience ?? {}, ...body }),
    ...(await benefitFields(body)),
  };
  if (!fields.title) throw new AppError('Title is required', 400);
  assertDates(fields);

  const voucher = await Voucher.create({ ...fields, code, adminId: adminId || null });
  const notification = body.notify ? await notifyAudience(adminId, voucher) : null;
  const [item] = await formatMany([voucher]);
  return { ...item, notification };
}

async function update(adminId, id, body = {}) {
  const voucher = await Voucher.findByPk(id);
  if (!voucher) throw new AppError('Voucher not found', 404);
  const patch = commonFields(body);

  const touchesBenefit = ['appliesTo', 'kind', 'discountType', 'discountValue', 'maxDiscountRupees', 'rewardCoins', 'targetId']
    .some((k) => body[k] !== undefined);
  if (touchesBenefit) {
    if (voucher.redeemedCount > 0) {
      throw new AppError('This voucher has been used — its offer can no longer be changed', 400);
    }
    Object.assign(patch, await benefitFields({ ...voucher.toJSON(), ...body }));
  }
  assertDates({ ...voucher.toJSON(), ...patch });
  await voucher.update(patch);
  const notification = body.notify ? await notifyAudience(adminId, voucher) : null;
  const [item] = await formatMany([voucher]);
  return { ...item, notification };
}

async function remove(id) {
  const voucher = await Voucher.findByPk(id);
  if (!voucher) throw new AppError('Voucher not found', 404);
  if (voucher.redeemedCount > 0) {
    throw new AppError('This voucher has been used — turn it off instead of deleting', 400);
  }
  await voucher.destroy();
  return { id };
}

async function redemptions(id, query = {}) {
  const { page, limit, offset } = parsePagination(query);
  const { rows, count } = await VoucherRedemption.findAndCountAll({
    where: { voucherId: id },
    include: [{ model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'mobileNumber'] }],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });
  return {
    items: rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      itemName: r.itemName,
      originalRupees: r.originalRupees,
      discountRupees: r.discountRupees,
      rewardCoins: r.rewardCoins,
      user: r.user
        ? {
            id: r.user.id,
            name: [r.user.firstName, r.user.lastName].filter(Boolean).join(' '),
            mobileNumber: r.user.mobileNumber,
          }
        : null,
    })),
    pagination: { page, limit, total: count, totalPages: count === 0 ? 0 : Math.ceil(count / limit) },
  };
}

module.exports = { list, create, update, remove, redemptions };
