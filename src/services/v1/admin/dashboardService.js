'use strict';

const { QueryTypes } = require('sequelize');
const { sequelize } = require('../../../models');
/** Start of today / this month in India time, as timestamptz. */
const TODAY = `(date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')`;
const MONTH = `(date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')`;
const PLAN_LIVE = `p.status = 'active' AND p."scheduledAt" >= now() - interval '24 hours'`;

async function one(sql) {
  const [row] = await sequelize.query(sql, { type: QueryTypes.SELECT });
  return row;
}

function many(sql) {
  return sequelize.query(sql, { type: QueryTypes.SELECT });
}

async function getOverview() {
  const [
    users,
    plans,
    social,
    memberships,
    coins,
    pending,
    topPlanTypes,
    topCities,
    trend,
    recentUsers,
    recentPlans,
    recentMemberships,
  ] = await Promise.all([
    one(`SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE "createdAt" >= ${TODAY})::int AS "newToday",
        count(*) FILTER (WHERE "createdAt" >= now() - interval '7 days')::int AS "new7d",
        count(*) FILTER (WHERE "isActive")::int AS active,
        count(*) FILTER (WHERE NOT "isActive")::int AS inactive,
        count(*) FILTER (WHERE gender = 'male')::int AS male,
        count(*) FILTER (WHERE gender = 'female')::int AS female,
        count(*) FILTER (WHERE "onboardingCompleted")::int AS onboarded
      FROM users`),
    one(`SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE ${PLAN_LIVE})::int AS live,
        count(*) FILTER (WHERE p."createdAt" >= ${TODAY})::int AS today,
        count(*) FILTER (WHERE p."createdAt" >= now() - interval '7 days')::int AS "last7d",
        coalesce(sum(p."notifiedCount"), 0)::int AS notified,
        (SELECT count(*)::int FROM plan_interests WHERE status = 'interested') AS interests,
        (SELECT count(*)::int FROM plan_interests WHERE status = 'interested' AND "createdAt" >= ${TODAY}) AS "interestsToday"
      FROM user_plans p`),
    one(`SELECT
        (SELECT count(*)::int FROM likes) AS interests,
        (SELECT count(*)::int FROM likes WHERE "createdAt" >= ${TODAY}) AS "interestsToday",
        (SELECT count(*)::int FROM likes WHERE status = 'matched') / 2 AS matches,
        (SELECT count(*)::int FROM likes WHERE status = 'matched' AND "updatedAt" >= ${TODAY}) / 2 AS "matchesToday",
        (SELECT count(*)::int FROM conversations) AS chats,
        (SELECT count(*)::int FROM messages) AS messages,
        (SELECT count(*)::int FROM messages WHERE "createdAt" >= ${TODAY}) AS "messagesToday",
        (SELECT count(*)::int FROM user_blocks) AS blocks`),
    one(`SELECT
        count(DISTINCT s."userId") FILTER (WHERE s.status = 'active' AND s."expiresAt" > now())::int AS active,
        count(DISTINCT s."userId") FILTER (WHERE s.status = 'active' AND s."expiresAt" > now() AND p.tier = 'chat')::int AS chat,
        count(DISTINCT s."userId") FILTER (WHERE s.status = 'active' AND s."expiresAt" > now() AND p.tier = 'connect')::int AS connect,
        count(DISTINCT s."userId") FILTER (WHERE s.status = 'active' AND s."expiresAt" > now() AND p.tier = 'plus')::int AS plus,
        count(DISTINCT s."userId") FILTER (WHERE s.status = 'active' AND s."expiresAt" > now()
          AND s."expiresAt" <= now() + interval '7 days')::int AS expiring,
        count(*) FILTER (WHERE s."createdAt" >= ${MONTH})::int AS "soldMonth",
        coalesce(sum(s."priceRupees"), 0)::int AS revenue,
        coalesce(sum(s."priceRupees") FILTER (WHERE s."createdAt" >= ${MONTH}), 0)::int AS "revenueMonth",
        coalesce(sum(s."priceRupees") FILTER (WHERE s."createdAt" >= ${TODAY}), 0)::int AS "revenueToday"
      FROM subscriptions s LEFT JOIN subscription_plans p ON p.id = s."planId"`),
    one(`SELECT
        (SELECT coalesce(sum("coinBalance"), 0)::int FROM users) AS "inWallets",
        (SELECT coalesce(-sum(amount), 0)::int FROM coin_transactions WHERE type = 'plan_post') AS "spentOnPlans",
        (SELECT coalesce(sum(amount), 0)::int FROM coin_transactions WHERE amount > 0) AS issued,
        (SELECT coalesce(sum(amount), 0)::int FROM payment_orders WHERE purpose = 'coin_pack' AND status = 'paid') AS "packRevenue",
        (SELECT coalesce(sum(amount), 0)::int FROM payment_orders WHERE purpose = 'coin_pack' AND status = 'paid'
          AND "paidAt" >= ${MONTH}) AS "packRevenueMonth"`),
    one(`SELECT
        (SELECT count(*)::int FROM users WHERE "bioStatus" = 'pending') AS bios,
        (SELECT count(*)::int FROM creator_requests WHERE status = 'pending') AS creators,
        (SELECT count(*)::int FROM chat_moderation_logs WHERE "reviewStatus" = 'pending') AS moderation,
        (SELECT count(*)::int FROM user_reports WHERE status = 'pending' AND source = 'profile') AS "profileReports",
        (SELECT count(*)::int FROM user_reports WHERE status = 'pending' AND source = 'chat') AS "chatReports"`),
    many(`SELECT p."planName" AS name, max(p."planEmoji") AS emoji, count(*)::int AS count
      FROM user_plans p WHERE p."createdAt" >= now() - interval '30 days'
      GROUP BY p."planName" ORDER BY count DESC LIMIT 5`),
    many(`SELECT c.name, count(*)::int AS count,
        count(*) FILTER (WHERE ${PLAN_LIVE})::int AS live
      FROM user_plans p JOIN cities c ON c.id = p."cityId"
      WHERE p."createdAt" >= now() - interval '30 days'
      GROUP BY c.name ORDER BY count DESC LIMIT 5`),
    many(`WITH days AS (
        SELECT generate_series(
          date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') - interval '6 days',
          date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata'),
          interval '1 day') AS d
      )
      SELECT to_char(d, 'YYYY-MM-DD') AS day,
        (SELECT count(*)::int FROM users u WHERE (u."createdAt" AT TIME ZONE 'Asia/Kolkata')::date = d::date) AS signups,
        (SELECT count(*)::int FROM user_plans p WHERE (p."createdAt" AT TIME ZONE 'Asia/Kolkata')::date = d::date) AS plans,
        (SELECT count(*)::int FROM likes l WHERE (l."createdAt" AT TIME ZONE 'Asia/Kolkata')::date = d::date) AS interests,
        (SELECT count(*)::int FROM messages m WHERE (m."createdAt" AT TIME ZONE 'Asia/Kolkata')::date = d::date) AS messages
      FROM days ORDER BY d`),
    many(`SELECT u.id, u."firstName", u."lastName", u.gender, u."createdAt", c.name AS "cityName"
      FROM users u LEFT JOIN cities c ON c.id = u."cityId"
      ORDER BY u."createdAt" DESC LIMIT 5`),
    many(`SELECT p.id, p."planName", p."planEmoji", p."areaName", p."createdAt", p."notifiedCount",
        (${PLAN_LIVE}) AS live, u.id AS "userId", u."firstName", c.name AS "cityName",
        (SELECT count(*)::int FROM plan_interests i WHERE i."planId" = p.id AND i.status = 'interested') AS interested
      FROM user_plans p
      JOIN users u ON u.id = p."userId"
      LEFT JOIN cities c ON c.id = p."cityId"
      ORDER BY p."createdAt" DESC LIMIT 5`),
    many(`SELECT s.id, s."planName", s."priceRupees", s."createdAt", s."expiresAt", p.tier,
        u.id AS "userId", u."firstName", u."lastName"
      FROM subscriptions s
      JOIN users u ON u.id = s."userId"
      LEFT JOIN subscription_plans p ON p.id = s."planId"
      ORDER BY s."createdAt" DESC LIMIT 5`),
  ]);

  return {
    users,
    plans,
    social,
    memberships,
    coins,
    pending: {
      ...pending,
      total: pending.bios + pending.creators + pending.moderation + pending.profileReports + pending.chatReports,
    },
    topPlanTypes,
    topCities,
    trend,
    recent: { users: recentUsers, plans: recentPlans, memberships: recentMemberships },
    generatedAt: new Date().toISOString(),
  };
}

const USER_NAME = (alias) => `trim(coalesce(${alias}."firstName", '') || ' ' || coalesce(${alias}."lastName", ''))`;

const DETAILS = {
  plans: {
    filters: {
      all: 'TRUE',
      live: PLAN_LIVE,
      today: `p."createdAt" >= ${TODAY}`,
      ended: `NOT (${PLAN_LIVE})`,
    },
    search: `(${USER_NAME('u')} ILIKE :q OR p."planName" ILIKE :q OR c.name ILIKE :q OR p."areaName" ILIKE :q)`,
    sql: (where) => `SELECT p.id, p."planName", p."planEmoji", p."areaName", p."scheduledAt", p."createdAt",
        p."notifiedCount", p."preferredGender", p.status, (${PLAN_LIVE}) AS live,
        u.id AS "userId", u."firstName", u."lastName", u.gender, c.name AS "cityName",
        (SELECT count(*)::int FROM plan_interests i WHERE i."planId" = p.id AND i.status = 'interested') AS interested,
        count(*) OVER()::int AS "_total"
      FROM user_plans p
      JOIN users u ON u.id = p."userId"
      LEFT JOIN cities c ON c.id = p."cityId"
      WHERE ${where}
      ORDER BY p."createdAt" DESC`,
  },
  interests: {
    filters: {
      all: 'TRUE',
      today: `x."createdAt" >= ${TODAY}`,
      matched: `x.kind = 'profile' AND x.status = 'matched' AND x."fromId" < x."toId"`,
      pending: `x.kind = 'profile' AND x.status <> 'matched'`,
      plan: `x.kind = 'plan'`,
    },
    search: `(${USER_NAME('f')} ILIKE :q OR ${USER_NAME('t')} ILIKE :q OR coalesce(x."planName", '') ILIKE :q)`,
    sql: (where) => `WITH x AS (
        SELECT 'profile' AS kind, l.id, l."fromUserId" AS "fromId", l."toUserId" AS "toId", l.status,
          l."createdAt", NULL::varchar AS "planName", NULL::varchar AS "planEmoji"
        FROM likes l
        UNION ALL
        SELECT 'plan', i.id, i."userId", p."userId", i.status, i."createdAt", p."planName", p."planEmoji"
        FROM plan_interests i JOIN user_plans p ON p.id = i."planId"
      )
      SELECT x.*, f."firstName" AS "fromFirstName", f."lastName" AS "fromLastName",
        t."firstName" AS "toFirstName", t."lastName" AS "toLastName",
        count(*) OVER()::int AS "_total"
      FROM x
      JOIN users f ON f.id = x."fromId"
      JOIN users t ON t.id = x."toId"
      WHERE ${where}
      ORDER BY x."createdAt" DESC`,
  },
  chats: {
    filters: {
      all: 'TRUE',
      today: `cv."lastMessageAt" >= ${TODAY}`,
      week: `cv."lastMessageAt" >= now() - interval '7 days'`,
      silent: `NOT EXISTS (SELECT 1 FROM messages mm WHERE mm."conversationId" = cv.id)`,
    },
    search: `(${USER_NAME('a')} ILIKE :q OR ${USER_NAME('b')} ILIKE :q)`,
    sql: (where) => `SELECT cv.id, cv."createdAt", cv."lastMessageAt",
        a.id AS "aId", a."firstName" AS "aFirstName", a."lastName" AS "aLastName",
        b.id AS "bId", b."firstName" AS "bFirstName", b."lastName" AS "bLastName",
        (SELECT count(*)::int FROM messages m WHERE m."conversationId" = cv.id) AS messages,
        (SELECT count(*)::int FROM messages m WHERE m."conversationId" = cv.id AND m."createdAt" >= ${TODAY}) AS "messagesToday",
        count(*) OVER()::int AS "_total"
      FROM conversations cv
      JOIN users a ON a.id = cv."participantOneId"
      JOIN users b ON b.id = cv."participantTwoId"
      WHERE ${where}
      ORDER BY cv."lastMessageAt" DESC NULLS LAST, cv."createdAt" DESC`,
  },
  payments: {
    filters: {
      all: 'TRUE',
      today: `x."paidAt" >= ${TODAY}`,
      month: `x."paidAt" >= ${MONTH}`,
      membership: `x.kind = 'membership'`,
      coins: `x.kind = 'coins'`,
    },
    search: `(${USER_NAME('u')} ILIKE :q OR coalesce(x.item, '') ILIKE :q)`,
    sql: (where) => `WITH x AS (
        SELECT 'membership' AS kind, s.id, s."userId", s."planName" AS item, s."priceRupees" AS amount,
          s."createdAt" AS "paidAt", s."expiresAt", sp.tier
        FROM subscriptions s LEFT JOIN subscription_plans sp ON sp.id = s."planId"
        UNION ALL
        SELECT 'coins', o.id, o."userId",
          coalesce(cp.name || ' · ' || cp.coins || ' coins', 'Coin pack'), o.amount,
          coalesce(o."paidAt", o."updatedAt"), NULL, NULL
        FROM payment_orders o LEFT JOIN coin_packs cp ON cp.id = o."referenceId"
        WHERE o.purpose = 'coin_pack' AND o.status = 'paid'
      )
      SELECT x.*, u."firstName", u."lastName",
        count(*) OVER()::int AS "_total",
        sum(x.amount) OVER()::int AS "_sum"
      FROM x JOIN users u ON u.id = x."userId"
      WHERE ${where}
      ORDER BY x."paidAt" DESC`,
  },
};

async function getDetails(type, { filter = 'all', search = '', page = 1, limit = 25 } = {}) {
  const def = DETAILS[type];
  if (!def) return null;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const size = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
  const conds = [def.filters[filter] || def.filters.all];
  const q = String(search || '').trim();
  if (q) conds.push(def.search);

  const rows = await sequelize.query(`${def.sql(conds.join(' AND '))} LIMIT :limit OFFSET :offset`, {
    type: QueryTypes.SELECT,
    replacements: { q: `%${q}%`, limit: size, offset: (pageNum - 1) * size },
  });
  const total = rows[0]?._total || 0;
  const sum = rows[0]?._sum;
  const items = rows.map(({ _total, _sum, ...r }) => r);
  return {
    type,
    filter: def.filters[filter] ? filter : 'all',
    items,
    ...(sum !== undefined ? { sum: sum || 0 } : {}),
    pagination: { page: pageNum, limit: size, total, pages: Math.max(1, Math.ceil(total / size)) },
  };
}

module.exports = { getOverview, getDetails };
