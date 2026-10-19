'use strict';

const { Op } = require('sequelize');
const { ChatModerationLog, PlatformSetting, User, sequelize } = require('../models');
const AppError = require('../utils/AppError');
const {
  MODERATION_CATEGORY,
  SEVERITY,
  DEFAULT_ENGINE_CONFIG,
  moderateChatMessage,
  normalizeEngineConfig,
} = require('../utils/chatModerationEngine');
const {
  getActiveModerationConfig,
  setActiveModerationConfig,
} = require('../utils/chatModerationConfig');
const { createAndEmitNotification } = require('./v1/user/notificationCreateService');

const SETTING_KEY = 'chatModeration';
const CACHE_MS = 60 * 1000;
let loadedAt = 0;

const REVIEW_STATUS = Object.freeze({
  NONE: 'none',
  PENDING: 'pending',
  DISMISSED: 'dismissed',
  WARNED: 'warned',
  SUSPENDED: 'suspended',
});

/** Category names written by the first (contact-only) version of the filter. */
const LEGACY_CATEGORIES = {
  [MODERATION_CATEGORY.CONTACT]: ['phone_number', 'email'],
  [MODERATION_CATEGORY.SOCIAL]: ['social_platform', 'social_handle', 'social_link', 'custom_word'],
};
const LEGACY_TO_CATEGORY = Object.fromEntries(
  Object.entries(LEGACY_CATEGORIES).flatMap(([cat, olds]) => olds.map((o) => [o, cat]))
);

function toCurrentCategories(list) {
  return [...new Set((Array.isArray(list) ? list : []).map((c) => LEGACY_TO_CATEGORY[c] || c))];
}

async function loadConfig({ force = false } = {}) {
  if (!force && Date.now() - loadedAt < CACHE_MS) return getActiveModerationConfig();
  try {
    const row = await PlatformSetting.findByPk(SETTING_KEY);
    let stored = {};
    if (row?.value) {
      try {
        stored = JSON.parse(row.value);
      } catch {
        stored = {};
      }
    }
    setActiveModerationConfig(stored);
  } catch (err) {
    // Keep the last known (or default) config — masking must never be skipped
    console.warn('[chat-moderation] could not load settings', err?.message || err);
  }
  loadedAt = Date.now();
  return getActiveModerationConfig();
}

/** Moderate a chat message. Never returns the original text. */
async function moderateMessageText(text) {
  const config = await loadConfig();
  const result = moderateChatMessage(text, config);
  return {
    masked: result.masked,
    flagged: result.flagged,
    categories: result.categories,
    severity: result.severity,
    matchCount: result.matchCount,
  };
}

async function assertCanChat(userId) {
  const user = await User.findByPk(userId, { attributes: ['id', 'chatSuspended'] });
  if (user?.chatSuspended) {
    const err = new AppError(
      'Your chat access has been suspended for violating community guidelines',
      403
    );
    err.code = 'CHAT_SUSPENDED';
    throw err;
  }
}

/**
 * Level 1: audit log only. Level 2: also counts a violation for the sender.
 * Level 3: also queued for admin review (no automatic suspension).
 */
async function logModeration({ messageId, conversationId, senderId, moderation, source = 'send' }) {
  if (!moderation?.flagged || !senderId) return null;
  const severity = Number(moderation.severity) || SEVERITY.MILD;
  const log = await ChatModerationLog.create({
    messageId: messageId || null,
    conversationId: conversationId || null,
    senderId,
    categories: moderation.categories,
    matchCount: moderation.matchCount || 0,
    action: 'masked',
    source,
    severity,
    reviewStatus: severity >= SEVERITY.CRITICAL ? REVIEW_STATUS.PENDING : REVIEW_STATUS.NONE,
  });
  if (severity >= SEVERITY.SEVERE) {
    await User.increment('chatViolationCount', { by: 1, where: { id: senderId } });
  }
  return log;
}

async function getSettings() {
  return loadConfig({ force: true });
}

function toList(value) {
  return Array.isArray(value) ? value : String(value || '').split(/[\n,]/);
}

async function updateSettings(updates) {
  if (!updates || typeof updates !== 'object') {
    throw new AppError('Settings must be an object', 400);
  }
  const current = await loadConfig({ force: true });
  const next = { ...current };
  for (const key of Object.keys(DEFAULT_ENGINE_CONFIG)) {
    if (!(key in updates)) continue;
    if (key === 'extraWords' || key === 'allowedWords') {
      next[key] = toList(updates[key]);
    } else if (key === 'customTerms') {
      next.customTerms = Array.isArray(updates.customTerms) ? updates.customTerms : [];
    } else {
      next[key] = updates[key] === true || updates[key] === 'true';
    }
  }
  const normalized = normalizeEngineConfig(next);
  await PlatformSetting.upsert({ key: SETTING_KEY, value: JSON.stringify(normalized) });
  setActiveModerationConfig(normalized);
  loadedAt = Date.now();
  return normalized;
}

/** Admin "try it" helper — runs the current filter without saving anything. */
async function previewText(text) {
  const config = await loadConfig();
  const result = moderateChatMessage(String(text || '').slice(0, 2000), config);
  return {
    masked: result.masked,
    flagged: result.flagged,
    categories: result.categories,
    severity: result.severity,
    educational: result.educational,
  };
}

async function getStats() {
  const rows = await ChatModerationLog.findAll({
    attributes: ['severity', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['severity'],
    raw: true,
  });
  const bySeverity = { 1: 0, 2: 0, 3: 0 };
  rows.forEach((r) => {
    bySeverity[Math.min(3, Math.max(1, Number(r.severity) || 1))] += Number(r.count) || 0;
  });
  const [pendingReview, suspendedUsers] = await Promise.all([
    ChatModerationLog.count({ where: { reviewStatus: REVIEW_STATUS.PENDING } }),
    User.count({ where: { chatSuspended: true } }),
  ]);
  return {
    total: bySeverity[1] + bySeverity[2] + bySeverity[3],
    mild: bySeverity[1],
    medium: bySeverity[2],
    severe: bySeverity[3],
    pendingReview,
    suspendedUsers,
  };
}

function categoryWhere(category) {
  const variants = [category, ...(LEGACY_CATEGORIES[category] || [])];
  return { [Op.or]: variants.map((c) => ({ categories: { [Op.contains]: [c] } })) };
}

async function listLogs({ page = 1, limit = 20, category, severity, reviewStatus, search } = {}) {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const and = [];
  if (category && Object.values(MODERATION_CATEGORY).includes(category)) {
    and.push(categoryWhere(category));
  }
  const sev = Number(severity);
  if ([1, 2, 3].includes(sev)) and.push({ severity: sev });
  if (reviewStatus && Object.values(REVIEW_STATUS).includes(reviewStatus)) {
    and.push({ reviewStatus });
  }

  const q = search && String(search).trim() ? `%${String(search).trim()}%` : null;
  const senderInclude = {
    model: User,
    as: 'sender',
    attributes: ['id', 'firstName', 'lastName', 'mobileNumber', 'chatViolationCount', 'chatWarningCount', 'chatSuspended'],
    required: Boolean(q),
  };
  if (q) {
    senderInclude.where = {
      [Op.or]: [
        { firstName: { [Op.iLike]: q } },
        { lastName: { [Op.iLike]: q } },
        { mobileNumber: { [Op.iLike]: q } },
      ],
    };
  }

  const { rows, count } = await ChatModerationLog.findAndCountAll({
    where: and.length ? { [Op.and]: and } : {},
    include: [senderInclude],
    order: [['createdAt', 'DESC']],
    limit: limitNum,
    offset: (pageNum - 1) * limitNum,
    distinct: true,
  });

  return {
    items: rows.map((row) => {
      const json = row.toJSON();
      return {
        id: json.id,
        messageId: json.messageId,
        conversationId: json.conversationId,
        senderId: json.senderId,
        sender: json.sender
          ? {
              id: json.sender.id,
              name: [json.sender.firstName, json.sender.lastName].filter(Boolean).join(' '),
              mobileNumber: json.sender.mobileNumber,
              violationCount: json.sender.chatViolationCount || 0,
              warningCount: json.sender.chatWarningCount || 0,
              chatSuspended: Boolean(json.sender.chatSuspended),
            }
          : null,
        categories: toCurrentCategories(json.categories),
        severity: json.severity || 1,
        matchCount: json.matchCount,
        action: json.action,
        source: json.source,
        reviewStatus: json.reviewStatus,
        reviewedAt: json.reviewedAt,
        adminNote: json.adminNote,
        detectedAt: json.createdAt,
      };
    }),
    total: count,
    page: pageNum,
    limit: limitNum,
    categories: Object.values(MODERATION_CATEGORY),
    reviewStatuses: Object.values(REVIEW_STATUS),
  };
}

async function setChatSuspended(userId, suspended) {
  const user = await User.findByPk(userId);
  if (!user) throw new AppError('User not found', 404);
  await user.update({ chatSuspended: suspended, chatSuspendedAt: suspended ? new Date() : null });
  await createAndEmitNotification({
    recipientId: user.id,
    type: suspended ? 'chat_suspended' : 'chat_restored',
    title: suspended ? 'Chat access suspended' : 'Chat access restored',
    body: suspended
      ? 'Your chat access has been suspended for repeated violations of our community guidelines.'
      : 'Your chat access has been restored. Please keep conversations respectful.',
    data: {},
  });
  return user;
}

/** action: dismiss | warn | suspend */
async function reviewLog(logId, { action, note } = {}, adminId = null) {
  const log = await ChatModerationLog.findByPk(logId);
  if (!log) throw new AppError('Moderation log not found', 404);

  const adminNote = note ? String(note).trim().slice(0, 500) || null : log.adminNote;
  let reviewStatus;
  if (action === 'dismiss') {
    reviewStatus = REVIEW_STATUS.DISMISSED;
  } else if (action === 'warn') {
    reviewStatus = REVIEW_STATUS.WARNED;
    await User.increment('chatWarningCount', { by: 1, where: { id: log.senderId } });
    await createAndEmitNotification({
      recipientId: log.senderId,
      type: 'chat_warning',
      title: 'Community guidelines warning',
      body: 'One of your chat messages broke our community guidelines. Repeated violations can lead to chat suspension.',
      data: { logId: log.id },
    });
  } else if (action === 'suspend') {
    reviewStatus = REVIEW_STATUS.SUSPENDED;
    await setChatSuspended(log.senderId, true);
  } else {
    throw new AppError('Action must be dismiss, warn or suspend', 400);
  }

  await log.update({ reviewStatus, reviewedBy: adminId, reviewedAt: new Date(), adminNote });
  return { id: log.id, reviewStatus, reviewedAt: log.reviewedAt, adminNote: log.adminNote };
}

async function restoreChatAccess(userId) {
  const user = await setChatSuspended(userId, false);
  return { userId: user.id, chatSuspended: false };
}

module.exports = {
  REVIEW_STATUS,
  loadConfig,
  moderateMessageText,
  assertCanChat,
  logModeration,
  getSettings,
  updateSettings,
  previewText,
  getStats,
  listLogs,
  reviewLog,
  restoreChatAccess,
};
