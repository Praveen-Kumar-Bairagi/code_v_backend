'use strict';

const { Op } = require('sequelize');
const { User } = require('../../../models');
const AppError = require('../../../utils/AppError');

const HANDLE_RE = /^[a-z0-9][a-z0-9._]{2,29}$/;
const MIN_MONTHS = 1;
const MAX_MONTHS = 12;

function isActiveCreator(user) {
  if (!user?.isCreator) return false;
  if (!user.creatorExpiresAt) return true;
  return new Date(user.creatorExpiresAt).getTime() > Date.now();
}

/** Sequelize where-fragment for currently valid creators. */
function activeCreatorWhere() {
  return {
    isCreator: true,
    [Op.or]: [{ creatorExpiresAt: null }, { creatorExpiresAt: { [Op.gt]: new Date() } }],
  };
}

function baseHandle(firstName, lastName) {
  const base = `${firstName || ''}${lastName || ''}`
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 24);
  return base.length >= 3 ? base : `${base}creator`.slice(0, 24);
}

/** praveenkumar → praveenkumar1 → praveenkumar2 … (first free one) */
async function generateUniqueHandle(firstName, lastName, { transaction } = {}) {
  const base = baseHandle(firstName, lastName);
  const taken = await User.findAll({
    where: { creatorHandle: { [Op.like]: `${base}%` } },
    attributes: ['creatorHandle'],
    transaction,
  });
  const used = new Set(taken.map((u) => u.creatorHandle));
  if (!used.has(base)) return base;
  for (let n = 1; n < 100000; n += 1) {
    const candidate = `${base}${n}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new AppError('Could not generate a unique creator id', 500);
}

/** Admin edit — validates format + uniqueness. */
async function normalizeHandleForUser(raw, userId, { transaction } = {}) {
  const handle = String(raw || '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
  if (!HANDLE_RE.test(handle)) {
    throw new AppError(
      'Creator ID must be 3–30 characters: lowercase letters, numbers, dot or underscore',
      400
    );
  }
  const clash = await User.findOne({
    where: { creatorHandle: handle, ...(userId ? { id: { [Op.ne]: userId } } : {}) },
    attributes: ['id'],
    transaction,
  });
  if (clash) throw new AppError('This creator ID is already taken', 409);
  return handle;
}

function assertDurationMonths(value) {
  const months = Number(value);
  if (!Number.isInteger(months) || months < MIN_MONTHS || months > MAX_MONTHS) {
    throw new AppError(`Duration must be between ${MIN_MONTHS} and ${MAX_MONTHS} months`, 400);
  }
  return months;
}

function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // Clamp e.g. 31 Jan + 1 month → 28/29 Feb instead of rolling into March
  if (d.getDate() < day) d.setDate(0);
  return d;
}

/** Make user a creator for N months (extends from current expiry if still active). */
async function grantCreator(user, months, { transaction } = {}) {
  const start = isActiveCreator(user) && user.creatorExpiresAt ? new Date(user.creatorExpiresAt) : new Date();
  const patch = {
    isCreator: true,
    creatorExpiresAt: addMonths(start, months),
  };
  if (!user.creatorHandle) {
    patch.creatorHandle = await generateUniqueHandle(user.firstName, user.lastName, { transaction });
  }
  await user.update(patch, { transaction });
  return user;
}

function creatorInfo(user) {
  const active = isActiveCreator(user);
  return {
    isCreator: active,
    creatorHandle: user?.creatorHandle || null,
    creatorExpiresAt: user?.creatorExpiresAt || null,
  };
}

module.exports = {
  MIN_MONTHS,
  MAX_MONTHS,
  isActiveCreator,
  activeCreatorWhere,
  generateUniqueHandle,
  normalizeHandleForUser,
  assertDurationMonths,
  addMonths,
  grantCreator,
  creatorInfo,
};
