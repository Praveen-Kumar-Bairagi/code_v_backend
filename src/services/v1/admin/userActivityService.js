'use strict';

const { QueryTypes } = require('sequelize');
const { sequelize, User } = require('../../../models');
const AppError = require('../../../utils/AppError');
const settingsService = require('../user/settingsService');
const adminService = require('./adminService');
const legalRetentionService = require('../../legalRetentionService');

const PLAN_LIVE = `p.status = 'active' AND p."scheduledAt" >= now() - interval '24 hours'`;

function select(sql, replacements) {
  return sequelize.query(sql, { type: QueryTypes.SELECT, replacements });
}

async function assertUser(id) {
  const user = await User.findByPk(id, { attributes: ['id'] });
  if (!user) throw new AppError('User not found', 404);
}

/** Everyone this user is linked to: likes, plan interests, chats and blocks, one row per person. */
function listConnections(id) {
  return select(
    `WITH links AS (
        SELECT "toUserId" AS other, 'liked' AS rel, "createdAt" AS at FROM likes WHERE "fromUserId" = :id
        UNION ALL
        SELECT "fromUserId", 'likedBy', "createdAt" FROM likes WHERE "toUserId" = :id
        UNION ALL
        SELECT p."userId", 'planSent', i."createdAt"
          FROM plan_interests i JOIN user_plans p ON p.id = i."planId" WHERE i."userId" = :id
        UNION ALL
        SELECT i."userId", 'planReceived', i."createdAt"
          FROM plan_interests i JOIN user_plans p ON p.id = i."planId" WHERE p."userId" = :id
        UNION ALL
        SELECT CASE WHEN c."participantOneId" = :id THEN c."participantTwoId" ELSE c."participantOneId" END,
          'chat', coalesce(c."lastMessageAt", c."createdAt")
          FROM conversations c WHERE :id IN (c."participantOneId", c."participantTwoId")
        UNION ALL
        SELECT "blockedId", 'blocked', "createdAt" FROM user_blocks WHERE "blockerId" = :id
        UNION ALL
        SELECT "blockerId", 'blockedBy', "createdAt" FROM user_blocks WHERE "blockedId" = :id
      )
      SELECT u.id, u."firstName", u."lastName", u.gender, u.photos, c.name AS "cityName",
        bool_or(l.rel = 'liked') AS liked,
        bool_or(l.rel = 'likedBy') AS "likedBy",
        bool_or(l.rel = 'planSent') AS "planSent",
        bool_or(l.rel = 'planReceived') AS "planReceived",
        bool_or(l.rel = 'blocked') AS blocked,
        bool_or(l.rel = 'blockedBy') AS "blockedBy",
        EXISTS (SELECT 1 FROM likes m WHERE m."fromUserId" = :id AND m."toUserId" = u.id AND m.status = 'matched') AS matched,
        max(l.at) AS "lastAt",
        cv.id AS "conversationId", cv."lastMessageAt",
        (SELECT count(*)::int FROM messages ms WHERE ms."conversationId" = cv.id) AS messages
      FROM links l
      JOIN users u ON u.id = l.other
      LEFT JOIN cities c ON c.id = u."cityId"
      LEFT JOIN LATERAL (
        SELECT cv.id, cv."lastMessageAt" FROM conversations cv
        WHERE (cv."participantOneId" = :id AND cv."participantTwoId" = u.id)
           OR (cv."participantTwoId" = :id AND cv."participantOneId" = u.id)
        ORDER BY cv."lastMessageAt" DESC NULLS LAST LIMIT 1
      ) cv ON TRUE
      GROUP BY u.id, c.name, cv.id, cv."lastMessageAt"
      ORDER BY max(l.at) DESC`,
    { id }
  );
}

async function getUserActivity(id) {
  await assertUser(id);
  const [settings, connections, plans, payments] = await Promise.all([
    settingsService.getSettings(id),
    listConnections(id),
    select(
      `SELECT p.id, p."planName", p."planEmoji", p."areaName", p."createdAt", p."scheduledAt",
          p."notifiedCount", p."preferredGender", p.status, (${PLAN_LIVE}) AS live, c.name AS "cityName",
          (SELECT count(*)::int FROM plan_interests i WHERE i."planId" = p.id AND i.status = 'interested') AS interested
        FROM user_plans p LEFT JOIN cities c ON c.id = p."cityId"
        WHERE p."userId" = :id
        ORDER BY p."createdAt" DESC LIMIT 20`,
      { id }
    ),
    select(
      `SELECT * FROM (
          SELECT 'membership' AS kind, s.id, s."planName" AS item, s."priceRupees" AS amount,
            s."createdAt" AS "paidAt", s."expiresAt", sp.tier
          FROM subscriptions s LEFT JOIN subscription_plans sp ON sp.id = s."planId"
          WHERE s."userId" = :id
          UNION ALL
          SELECT 'coins', o.id, coalesce(cp.name || ' · ' || cp.coins || ' coins', 'Coin pack'), o.amount,
            coalesce(o."paidAt", o."updatedAt"), NULL, NULL
          FROM payment_orders o LEFT JOIN coin_packs cp ON cp.id = o."referenceId"
          WHERE o."userId" = :id AND o.purpose = 'coin_pack' AND o.status = 'paid'
        ) x ORDER BY "paidAt" DESC LIMIT 20`,
      { id }
    ),
  ]);

  return {
    settings,
    connections: connections.map((r) => ({
      ...r,
      photoUrl: Array.isArray(r.photos) ? r.photos.find(Boolean) || null : null,
      photos: undefined,
    })),
    plans,
    payments,
  };
}

async function updateUserSettings(id, body) {
  await assertUser(id);
  return settingsService.updateSettings(id, body);
}

/** Removes one photo (index in the user's uploaded photos, empty slots skipped) and deletes the file. */
async function removeUserPhoto(id, index) {
  const user = await User.findByPk(id, { attributes: ['id', 'photos'] });
  if (!user) throw new AppError('User not found', 404);
  const photos = (Array.isArray(user.photos) ? user.photos : []).filter(Boolean);
  const i = Number(index);
  if (!Number.isInteger(i) || i < 0 || i >= photos.length) throw new AppError('Photo not found', 404);

  const [removed] = photos.splice(i, 1);
  await user.update({ photos });
  // The file is deleted by the retention job after 180 days (IT Rules 2021, Rule 3(1)(g)).
  await legalRetentionService.archiveRemovedPhoto(user.id, removed);
  return adminService.getUserById(id);
}

module.exports = { getUserActivity, updateUserSettings, removeUserPhoto };
