'use strict';

const { QueryTypes } = require('sequelize');
const { sequelize, SubscriptionPlan } = require('../../../models');

const STATUSES = ['all', 'active', 'expiring', 'expired', 'none'];
const TIERS = ['chat', 'connect', 'plus'];
const EXPIRING_DAYS = 7;

/**
 * Each user with their current membership: the active one if any,
 * otherwise the most recently expired one (null = never bought).
 */
const CURRENT_SUB = `
  LEFT JOIN LATERAL (
    SELECT s.id, s."planId", s."planName", s."priceRupees", s."durationDays",
           s."startedAt", s."expiresAt", s."paymentMethod", p.tier,
           (s.status = 'active' AND s."expiresAt" > now()) AS "isActive"
    FROM subscriptions s
    LEFT JOIN subscription_plans p ON p.id = s."planId"
    WHERE s."userId" = u.id
    ORDER BY (s.status = 'active' AND s."expiresAt" > now()) DESC, s."expiresAt" DESC
    LIMIT 1
  ) cs ON true`;

function buildFilters({ status, planId, tier, search }) {
  const where = [];
  const replacements = {};

  if (status === 'active') where.push('cs."isActive"');
  else if (status === 'expiring') {
    where.push(`cs."isActive" AND cs."expiresAt" <= now() + interval '${EXPIRING_DAYS} days'`);
  } else if (status === 'expired') where.push('cs.id IS NOT NULL AND NOT cs."isActive"');
  else if (status === 'none') where.push('cs.id IS NULL');

  if (planId) {
    where.push('cs."planId" = :planId');
    replacements.planId = planId;
  } else if (TIERS.includes(tier)) {
    where.push('cs.tier = :tier');
    replacements.tier = tier;
  }

  const q = String(search || '').trim();
  if (q) {
    where.push(`(u."firstName" ILIKE :q OR u."lastName" ILIKE :q OR u."mobileNumber" ILIKE :q
      OR concat_ws(' ', u."firstName", u."lastName") ILIKE :q)`);
    replacements.q = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
  }

  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', replacements };
}

async function summary() {
  const [row] = await sequelize.query(
    `SELECT
       count(*)::int AS "totalUsers",
       count(*) FILTER (WHERE cs."isActive")::int AS active,
       count(*) FILTER (WHERE cs."isActive" AND cs."expiresAt" <= now() + interval '${EXPIRING_DAYS} days')::int AS expiring,
       count(*) FILTER (WHERE cs.id IS NOT NULL AND NOT cs."isActive")::int AS expired,
       count(*) FILTER (WHERE cs.id IS NULL)::int AS "none",
       count(*) FILTER (WHERE cs."isActive" AND cs.tier = 'chat')::int AS "activeChat",
       count(*) FILTER (WHERE cs."isActive" AND cs.tier = 'connect')::int AS "activeConnect",
       count(*) FILTER (WHERE cs."isActive" AND cs.tier = 'plus')::int AS "activePlus"
     FROM users u ${CURRENT_SUB}`,
    { type: QueryTypes.SELECT }
  );
  return row;
}

async function listUserPlans({ status = 'all', planId, tier, search, page = 1, limit = 25 } = {}) {
  const st = STATUSES.includes(status) ? status : 'all';
  const take = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const current = Math.max(Number(page) || 1, 1);
  const { sql, replacements } = buildFilters({ status: st, planId, tier, search });

  const [rows, [{ total }], stats, plans] = await Promise.all([
    sequelize.query(
      `SELECT u.id, u."firstName", u."lastName", u."mobileNumber", u.gender, u."createdAt" AS "joinedAt",
              c.name AS "cityName",
              cs.id AS "subscriptionId", cs."planId", cs."planName", cs.tier, cs."priceRupees",
              cs."durationDays", cs."startedAt", cs."expiresAt", cs."paymentMethod", cs."isActive",
              (SELECT count(*)::int FROM subscriptions x WHERE x."userId" = u.id) AS purchases
       FROM users u
       LEFT JOIN cities c ON c.id = u."cityId"
       ${CURRENT_SUB}
       ${sql}
       ORDER BY cs."isActive" DESC NULLS LAST, cs."startedAt" DESC NULLS LAST, u."createdAt" DESC
       LIMIT :limit OFFSET :offset`,
      {
        type: QueryTypes.SELECT,
        replacements: { ...replacements, limit: take, offset: (current - 1) * take },
      }
    ),
    sequelize.query(`SELECT count(*)::int AS total FROM users u ${CURRENT_SUB} ${sql}`, {
      type: QueryTypes.SELECT,
      replacements,
    }),
    summary(),
    SubscriptionPlan.findAll({
      attributes: ['id', 'name', 'tier', 'priceRupees', 'durationDays', 'isActive'],
      order: [['sortOrder', 'ASC'], ['priceRupees', 'ASC']],
    }),
  ]);

  const now = Date.now();
  return {
    items: rows.map((r) => {
      const plan = r.subscriptionId
        ? {
            subscriptionId: r.subscriptionId,
            planId: r.planId,
            name: r.planName,
            tier: r.tier || null,
            priceRupees: r.priceRupees,
            durationDays: r.durationDays,
            startedAt: r.startedAt,
            expiresAt: r.expiresAt,
            paymentMethod: r.paymentMethod,
            isActive: !!r.isActive,
            daysLeft: r.isActive
              ? Math.max(0, Math.ceil((new Date(r.expiresAt).getTime() - now) / 86400000))
              : 0,
          }
        : null;
      return {
        id: r.id,
        firstName: r.firstName,
        lastName: r.lastName,
        mobileNumber: r.mobileNumber,
        gender: r.gender,
        cityName: r.cityName,
        joinedAt: r.joinedAt,
        purchases: r.purchases,
        status: !plan ? 'none' : plan.isActive ? 'active' : 'expired',
        plan,
      };
    }),
    summary: stats,
    plans: plans.map((p) => p.toJSON()),
    pagination: {
      page: current,
      limit: take,
      total,
      totalPages: Math.max(1, Math.ceil(total / take)),
    },
  };
}

module.exports = { listUserPlans };
