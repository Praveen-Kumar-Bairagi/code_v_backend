'use strict';

const { QueryTypes } = require('sequelize');
const { sequelize, User, City, Conversation, UserReport } = require('../../../models');
const AppError = require('../../../utils/AppError');
const blockService = require('./blockService');
const { decryptText } = require('../../../utils/messageCrypto');

const REPORT_REASONS = {
  intimate_images: 'Private or intimate images',
  impersonation: 'Impersonation',
  fake_profile: 'Fake profile',
  inappropriate_photos: 'Inappropriate photos',
  harassment: 'Harassment or abuse',
  sexual_content: 'Sexual or vulgar messages',
  scam: 'Scam or asking for money',
  underage: 'Looks under age',
  hate_threats: 'Hate speech or threats',
  spam: 'Spam or promotion',
  other: 'Something else',
};

const SOURCES = ['profile', 'chat'];
const MAX_DETAILS = 1000;
const EVIDENCE_MESSAGES = 300;
const MAX_EVIDENCE_BODY = 4000;

async function profileSnapshot(userId) {
  const user = await User.findByPk(userId, {
    attributes: ['id', 'firstName', 'lastName', 'gender', 'dateOfBirth', 'aboutMe', 'photos', 'profession'],
    include: [{ model: City, as: 'city', attributes: ['name'] }],
  });
  if (!user) return null;
  const json = user.toJSON();
  return {
    firstName: json.firstName,
    lastName: json.lastName,
    gender: json.gender,
    dateOfBirth: json.dateOfBirth,
    aboutMe: json.aboutMe,
    profession: json.profession,
    cityName: json.city?.name || null,
    photos: (Array.isArray(json.photos) ? json.photos : []).filter(Boolean),
  };
}

/** Text the reporter's app decrypted for end-to-end encrypted messages, keyed by message id. */
function reporterPlaintext(list) {
  const out = new Map();
  (Array.isArray(list) ? list : []).slice(0, EVIDENCE_MESSAGES).forEach((m) => {
    const id = String(m?.id || '');
    if (!/^[0-9a-f-]{36}$/i.test(id) || typeof m.body !== 'string') return;
    out.set(id, m.body.slice(0, MAX_EVIDENCE_BODY));
  });
  return out;
}

async function chatSnapshot(conversationId, evidenceMessages) {
  const rows = await sequelize.query(
    `SELECT * FROM (
        SELECT id, "senderId", body, "originalBody", kind, "createdAt", (e2ee IS NOT NULL) AS encrypted
        FROM messages WHERE "conversationId" = :conversationId
        ORDER BY "createdAt" DESC LIMIT ${EVIDENCE_MESSAGES}
      ) m ORDER BY "createdAt" ASC`,
    { type: QueryTypes.SELECT, replacements: { conversationId } }
  );
  const shared = reporterPlaintext(evidenceMessages);
  return rows.map((m) => {
    if (m.encrypted) {
      const body = shared.get(String(m.id));
      return {
        id: m.id,
        senderId: m.senderId,
        body: body ?? null,
        maskedBody: null,
        // End-to-end encrypted: we only have what the reporter's app decrypted and sent.
        source: body != null ? 'reporter_device' : 'not_shared',
        kind: m.kind || 'text',
        createdAt: m.createdAt,
      };
    }
    return {
      id: m.id,
      senderId: m.senderId,
      body: decryptText(m.originalBody) || decryptText(m.body),
      maskedBody: m.originalBody ? decryptText(m.body) : null,
      source: 'server',
      kind: m.kind || 'text',
      createdAt: m.createdAt,
    };
  });
}

async function createReport(reporterId, body = {}) {
  const reportedUserId = String(body.reportedUserId || body.userId || '').trim();
  const source = SOURCES.includes(body.source) ? body.source : 'profile';
  const reason = String(body.reason || '').trim();
  const details = String(body.details || '').trim().slice(0, MAX_DETAILS) || null;

  if (!reportedUserId) throw new AppError('Choose who you are reporting', 400);
  if (String(reportedUserId) === String(reporterId)) throw new AppError('You cannot report yourself', 400);
  if (!REPORT_REASONS[reason]) throw new AppError('Choose a reason for the report', 400);
  if (reason === 'other' && !details) throw new AppError('Please tell us what happened', 400);

  const target = await User.findByPk(reportedUserId, { attributes: ['id'] });
  if (!target) throw new AppError('User not found', 404);

  let conversationId = null;
  if (source === 'chat') {
    conversationId = String(body.conversationId || '').trim() || null;
    if (!conversationId) throw new AppError('Conversation is required for a chat report', 400);
    const conversation = await Conversation.findByPk(conversationId, {
      attributes: ['id', 'participantOneId', 'participantTwoId'],
    });
    const ids = conversation ? [String(conversation.participantOneId), String(conversation.participantTwoId)] : [];
    if (!ids.includes(String(reporterId)) || !ids.includes(String(reportedUserId))) {
      throw new AppError('Conversation not found', 404);
    }
  }

  const evidence = {
    profile: await profileSnapshot(reportedUserId),
    ...(conversationId ? { messages: await chatSnapshot(conversationId, body.evidenceMessages) } : {}),
  };

  const existing = await UserReport.findOne({
    where: { reporterId, reportedUserId, source, status: 'pending' },
  });
  let report;
  if (existing) {
    const merged = [existing.details, details].filter(Boolean).join('\n---\n').slice(0, MAX_DETAILS * 3) || null;
    report = await existing.update({ reason, details: merged, evidence, conversationId: conversationId || existing.conversationId });
  } else {
    report = await UserReport.create({ reporterId, reportedUserId, source, conversationId, reason, details, evidence });
  }

  let blocked = false;
  if (body.block) {
    await blockService.blockUser(reporterId, reportedUserId);
    blocked = true;
  }

  return { id: report.id, status: report.status, blocked, updated: !!existing };
}

function listReasons() {
  return Object.entries(REPORT_REASONS).map(([id, label]) => ({ id, label }));
}

module.exports = { REPORT_REASONS, createReport, listReasons };
