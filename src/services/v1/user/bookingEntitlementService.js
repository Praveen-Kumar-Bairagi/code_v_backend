'use strict';

const { Op } = require('sequelize');
const { User, sequelize } = require('../../../models');
const AppError = require('../../../utils/AppError');

const SUBSCRIPTION_REQUIRED = 'SUBSCRIPTION_REQUIRED';

const KINDS = {
  create: { column: 'freeBookingCreatesLeft', action: 'create a booking' },
  accept: { column: 'freeBookingAcceptsLeft', action: 'accept a booking' },
};

function kindConfig(kind) {
  const cfg = KINDS[kind];
  if (!cfg) throw new Error(`Unknown booking entitlement kind: ${kind}`);
  return cfg;
}

function subscriptionRequired(kind) {
  const { action } = kindConfig(kind);
  return new AppError(
    `Your free booking is used. An active subscription is required to ${action}.`,
    402,
    SUBSCRIPTION_REQUIRED
  );
}

async function getFreeCredits(userId, { transaction } = {}) {
  const user = await User.findByPk(userId, {
    attributes: ['id', 'freeBookingCreatesLeft', 'freeBookingAcceptsLeft'],
    transaction,
  });
  return {
    freeBookingCreatesLeft: Math.max(0, Number(user?.freeBookingCreatesLeft || 0)),
    freeBookingAcceptsLeft: Math.max(0, Number(user?.freeBookingAcceptsLeft || 0)),
  };
}

/**
 * Subscription wins; otherwise a free credit must be available.
 * Returns { useFree } — caller consumes the credit when the action actually happens.
 */
async function assertCanUse(userId, kind) {
  const subscriptionService = require('./subscriptionService');
  const status = await subscriptionService.getStatus(userId);
  if (status.isActive) return { useFree: false };
  const credits = await getFreeCredits(userId);
  if (credits[kindConfig(kind).column] > 0) return { useFree: true };
  throw subscriptionRequired(kind);
}

/** Atomic decrement — fails (402) if another request already used the last credit. */
async function consumeFreeCredit(userId, kind, { transaction } = {}) {
  const { column } = kindConfig(kind);
  const [count] = await User.update(
    { [column]: sequelize.literal(`"${column}" - 1`) },
    { where: { id: userId, [column]: { [Op.gt]: 0 } }, transaction }
  );
  if (!count) throw subscriptionRequired(kind);
}

module.exports = {
  SUBSCRIPTION_REQUIRED,
  getFreeCredits,
  assertCanUse,
  consumeFreeCredit,
};
