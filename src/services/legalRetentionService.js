'use strict';

const { Op, QueryTypes } = require('sequelize');
const { LegalRetentionRecord, LegalRequest, DeviceSession, City, sequelize } = require('../models');
const storageService = require('./storageService');

/** IT Rules 2021, Rule 3(1)(g)/(h): keep for 180 days, or longer when an authority asks us to. */
const RETENTION_DAYS = 180;
const DAY_MS = 24 * 60 * 60 * 1000;

function purgeDate(from = new Date()) {
  return new Date(from.getTime() + RETENTION_DAYS * DAY_MS);
}

async function hasOpenRequest(userIds, transaction) {
  const ids = userIds.filter(Boolean).map(String);
  if (!ids.length) return false;
  const count = await LegalRequest.count({
    where: { userId: { [Op.in]: ids }, receivedAt: { [Op.gte]: new Date(Date.now() - RETENTION_DAYS * DAY_MS) } },
    transaction,
  });
  return count > 0;
}

/**
 * Copies conversations and their messages before they are deleted. Message text is copied as
 * stored — server-encrypted or end-to-end encrypted — and is never decrypted here.
 */
async function archiveConversations(conversationIds, { reason, actorId = null, transaction } = {}) {
  const ids = (conversationIds || []).filter(Boolean).map(String);
  if (!ids.length) return 0;
  const conversations = await sequelize.query(
    `SELECT id, "participantOneId", "participantTwoId", "lastMessageAt", "createdAt"
       FROM conversations WHERE id IN (:ids)`,
    { type: QueryTypes.SELECT, replacements: { ids }, transaction }
  );
  const messages = await sequelize.query(
    `SELECT id, "conversationId", "senderId", body, "originalBody", e2ee, kind, meta, "replyToId", "createdAt"
       FROM messages WHERE "conversationId" IN (:ids) ORDER BY "createdAt" ASC`,
    { type: QueryTypes.SELECT, replacements: { ids }, transaction }
  );
  const byConversation = new Map(ids.map((id) => [id, []]));
  messages.forEach((m) => byConversation.get(String(m.conversationId))?.push(m));

  const now = new Date();
  const rows = [];
  for (const c of conversations) {
    const one = String(c.participantOneId);
    const two = String(c.participantTwoId);
    const subject = actorId && String(actorId) === two ? two : one;
    rows.push({
      kind: 'deleted_conversation',
      reason,
      subjectUserId: subject,
      relatedUserId: subject === one ? two : one,
      data: { conversation: c, actorId: actorId ? String(actorId) : null, messages: byConversation.get(String(c.id)) || [] },
      purgeAfter: purgeDate(now),
      legalHold: await hasOpenRequest([one, two], transaction),
    });
  }
  if (rows.length) await LegalRetentionRecord.bulkCreate(rows, { transaction });
  return rows.length;
}

/** Registration details as they were just before the account was deleted. */
async function archiveDeletedAccount(user, { transaction } = {}) {
  const json = user.toJSON ? user.toJSON() : user;
  const [city, sessions] = await Promise.all([
    json.cityId ? City.findByPk(json.cityId, { attributes: ['name'], transaction }) : null,
    DeviceSession.findAll({
      where: { userId: json.id },
      attributes: ['deviceName', 'platform', 'appVersion', 'userAgent', 'ipAddress', 'lastIpAddress', 'createdAt', 'lastActiveAt', 'revokedAt'],
      transaction,
    }),
  ]);
  await LegalRetentionRecord.create(
    {
      kind: 'deleted_account',
      reason: 'account_deleted',
      subjectUserId: json.id,
      data: {
        account: {
          id: json.id,
          firstName: json.firstName,
          lastName: json.lastName,
          gender: json.gender,
          dateOfBirth: json.dateOfBirth,
          mobileNumber: json.mobileNumber,
          email: json.email,
          googleUid: json.googleUid,
          cityName: city?.name || null,
          createdAt: json.createdAt,
          deletedAt: new Date(),
        },
        sessions: sessions.map((s) => s.toJSON()),
      },
      purgeAfter: purgeDate(),
      legalHold: await hasOpenRequest([json.id], transaction),
    },
    { transaction }
  );
}

/** A photo removed by our team: the file is kept until the record is purged. */
async function archiveRemovedPhoto(userId, path, { adminId = null } = {}) {
  await LegalRetentionRecord.create({
    kind: 'removed_photo',
    reason: 'admin_removed',
    subjectUserId: userId,
    data: { path, adminId },
    purgeAfter: purgeDate(),
    legalHold: await hasOpenRequest([userId]),
  });
}

async function setLegalHold(userId, hold = true) {
  const [count] = await LegalRetentionRecord.update(
    { legalHold: !!hold },
    { where: { [Op.or]: [{ subjectUserId: userId }, { relatedUserId: userId }] } }
  );
  return count;
}

async function recordsForUser(userId) {
  return LegalRetentionRecord.findAll({
    where: { [Op.or]: [{ subjectUserId: userId }, { relatedUserId: userId }] },
    order: [['createdAt', 'ASC']],
  });
}

async function purgeExpired({ limit = 200 } = {}) {
  const expired = await LegalRetentionRecord.findAll({
    where: { purgeAfter: { [Op.lt]: new Date() }, legalHold: false },
    limit,
  });
  for (const record of expired) {
    if (record.kind === 'removed_photo' && record.data?.path) {
      try {
        await storageService.deleteProfilePicture(String(record.data.path));
      } catch (err) {
        console.warn('[legal-retention] photo delete failed', err?.message || err);
      }
    }
    await record.destroy();
  }
  return expired.length;
}

module.exports = {
  RETENTION_DAYS,
  archiveConversations,
  archiveDeletedAccount,
  archiveRemovedPhoto,
  setLegalHold,
  recordsForUser,
  purgeExpired,
};
