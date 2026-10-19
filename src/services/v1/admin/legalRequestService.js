'use strict';

const { QueryTypes } = require('sequelize');
const { sequelize, User, LegalRequest } = require('../../../models');
const AppError = require('../../../utils/AppError');
const { decryptText } = require('../../../utils/messageCrypto');
const legalRetentionService = require('../../legalRetentionService');

/** IT Rules 2021, Rule 3(1)(j): information must be provided within 72 hours of a lawful order. */
const RESPONSE_HOURS = 72;
const UUID_RE = /^[0-9a-f-]{36}$/i;

function select(sql, replacements) {
  return sequelize.query(sql, { type: QueryTypes.SELECT, replacements });
}

function shape(row) {
  const json = row.toJSON ? row.toJSON() : row;
  return {
    ...json,
    dueAt: new Date(new Date(json.receivedAt).getTime() + RESPONSE_HOURS * 60 * 60 * 1000),
  };
}

function clean(value, max) {
  return String(value || '').trim().slice(0, max);
}

/** Logs the request and places the user's preserved records on legal hold. */
async function createRequest(adminId, userId, body = {}) {
  if (!UUID_RE.test(String(userId))) throw new AppError('User not found', 404);
  const user = await User.findByPk(userId, { attributes: ['id'] });
  if (!user) throw new AppError('User not found', 404);
  const agency = clean(body.agency, 200);
  const referenceNo = clean(body.referenceNo, 200);
  if (!agency) throw new AppError('Enter the agency or court that sent the request', 400);
  if (!referenceNo) throw new AppError('Enter the notice / order reference number', 400);
  const receivedAt = body.receivedAt ? new Date(body.receivedAt) : new Date();
  if (Number.isNaN(receivedAt.getTime())) throw new AppError('Invalid received date', 400);

  const request = await LegalRequest.create({
    userId,
    adminId: adminId || null,
    agency,
    referenceNo,
    legalBasis: clean(body.legalBasis, 200) || null,
    receivedAt,
    notes: clean(body.notes, 2000) || null,
  });
  await legalRetentionService.setLegalHold(userId, true);
  return shape(request);
}

async function listRequests(userId) {
  const rows = await LegalRequest.findAll({ where: { userId }, order: [['receivedAt', 'DESC']] });
  return rows.map(shape);
}

/** Server-encrypted text can be read; end-to-end encrypted messages are given as stored. */
function exportMessage(m) {
  const base = { id: m.id, senderId: m.senderId, kind: m.kind || 'text', createdAt: m.createdAt, replyToId: m.replyToId || null };
  if (m.e2ee) {
    return { ...base, encryption: 'end_to_end', text: null, ciphertext: m.e2ee };
  }
  const shown = decryptText(m.body);
  const original = m.originalBody ? decryptText(m.originalBody) : null;
  return {
    ...base,
    encryption: 'server',
    text: original || shown,
    ...(original ? { textShownToRecipient: shown } : {}),
    meta: m.meta || null,
  };
}

async function buildExport(userId) {
  const [account] = await select(
    `SELECT u.id, u."firstName", u."lastName", u.gender, u."dateOfBirth", u."mobileNumber", u.email, u."googleUid",
            u."accountStatus", u."isActive", u."createdAt", u."lastActiveAt", u.latitude, u.longitude,
            u."locationUpdatedAt", c.name AS "cityName"
       FROM users u LEFT JOIN cities c ON c.id = u."cityId" WHERE u.id = :userId`,
    { userId }
  );
  if (!account) throw new AppError('User not found', 404);

  const [sessions, conversations, reports, moderationLogs, payments, subscriptions, coins] = await Promise.all([
    select(
      `SELECT id, "deviceName", platform, "appVersion", "userAgent", "ipAddress", "lastIpAddress",
              "createdAt", "lastActiveAt", "revokedAt"
         FROM device_sessions WHERE "userId" = :userId ORDER BY "createdAt" ASC`,
      { userId }
    ),
    select(
      `SELECT c.id, c."createdAt", c."lastMessageAt",
              CASE WHEN c."participantOneId" = :userId THEN c."participantTwoId" ELSE c."participantOneId" END AS "peerId"
         FROM conversations c WHERE c."participantOneId" = :userId OR c."participantTwoId" = :userId
         ORDER BY c."createdAt" ASC`,
      { userId }
    ),
    select(
      `SELECT id, "reporterId", "reportedUserId", source, reason, details, status, evidence, "createdAt", "reviewedAt"
         FROM user_reports WHERE "reporterId" = :userId OR "reportedUserId" = :userId ORDER BY "createdAt" ASC`,
      { userId }
    ),
    select(
      `SELECT id, "conversationId", "messageId", categories, severity, "matchCount", "reviewStatus", "createdAt"
         FROM chat_moderation_logs WHERE "senderId" = :userId ORDER BY "createdAt" ASC`,
      { userId }
    ),
    select(`SELECT * FROM payment_orders WHERE "userId" = :userId ORDER BY "createdAt" ASC`, { userId }),
    select(`SELECT * FROM subscriptions WHERE "userId" = :userId ORDER BY "createdAt" ASC`, { userId }),
    select(`SELECT * FROM coin_transactions WHERE "userId" = :userId ORDER BY "createdAt" ASC`, { userId }),
  ]);

  const conversationIds = conversations.map((c) => c.id);
  const peerIds = [...new Set(conversations.map((c) => c.peerId))];
  const [messages, peers] = await Promise.all([
    conversationIds.length
      ? select(
          `SELECT id, "conversationId", "senderId", body, "originalBody", e2ee, kind, meta, "replyToId", "createdAt"
             FROM messages WHERE "conversationId" IN (:ids) ORDER BY "createdAt" ASC`,
          { ids: conversationIds }
        )
      : [],
    peerIds.length
      ? select(`SELECT id, "firstName", "lastName", "mobileNumber" FROM users WHERE id IN (:ids)`, { ids: peerIds })
      : [],
  ]);
  const peerById = new Map(peers.map((p) => [String(p.id), p]));

  const retained = (await legalRetentionService.recordsForUser(userId)).map((r) => {
    const json = r.toJSON();
    if (json.kind === 'deleted_conversation') {
      json.data = { ...json.data, messages: (json.data.messages || []).map(exportMessage) };
    }
    return json;
  });

  return {
    account,
    deviceSessions: sessions,
    conversations: conversations.map((c) => ({
      ...c,
      peer: peerById.get(String(c.peerId)) || null,
      messages: messages.filter((m) => String(m.conversationId) === String(c.id)).map(exportMessage),
    })),
    preservedAfterDeletion: retained,
    reports,
    moderationLogs,
    payments: { paymentOrders: payments, subscriptions, coinTransactions: coins },
  };
}

async function exportForRequest(requestId) {
  if (!UUID_RE.test(String(requestId))) throw new AppError('Request not found', 404);
  const request = await LegalRequest.findByPk(requestId);
  if (!request) throw new AppError('Request not found', 404);
  const data = await buildExport(request.userId);
  await request.update({ lastExportedAt: new Date() });
  return {
    generatedAt: new Date().toISOString(),
    request: shape(request),
    notes: [
      'Messages marked "end_to_end" are end-to-end encrypted. Compameet does not hold the keys and cannot decrypt them; they are provided exactly as stored.',
      'Messages marked "server" were encrypted by Compameet and are provided decrypted.',
      '"preservedAfterDeletion" contains records kept for 180 days after deletion under IT Rules 2021, Rule 3(1)(g)/(h).',
      'IP addresses are recorded from the time this feature was introduced; earlier sessions have none.',
    ],
    ...data,
  };
}

module.exports = { createRequest, listRequests, exportForRequest, RESPONSE_HOURS };
