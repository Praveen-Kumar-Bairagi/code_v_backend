const { Op } = require('sequelize');
const { Conversation, Message, Subscription, User, sequelize } = require('../../../models');
const AppError = require('../../../utils/AppError');
const { sortParticipantIds } = require('../../../utils/conversationPair');
const { emitToConversation, emitToUser, isUserViewingConversation } = require('../../../socket/io');
const storageService = require('../../storageService');
const subscriptionService = require('./subscriptionService');
const pushTokenService = require('./pushTokenService');
const { sendPushBatch, scheduleReceiptCheck } = require('../../expoPushService');
const chatModerationService = require('../../chatModerationService');
const { maskChatText } = require('../../../utils/chatModerationConfig');
const { MODERATION_CATEGORY, SEVERITY } = require('../../../utils/chatModerationEngine');
const { settingsOf, wantsPush } = require('./settingsService');
const e2eeKeyService = require('./e2eeKeyService');

const userPreviewAttributes = ['id', 'firstName', 'lastName', 'photos', 'dateOfBirth'];
/** Chat-list participants also need settings so ✓✓ honours the peer's "Hide Seen". */
const listParticipantAttributes = [...userPreviewAttributes, 'settings'];

const IST_OFFSET_MS = 330 * 60 * 1000;

/** Today's month-day keys in IST; 29 Feb birthdays are celebrated on 28 Feb in non-leap years. */
function birthdayKeysToday(now = new Date()) {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const year = ist.getUTCFullYear();
  const key = `${String(ist.getUTCMonth() + 1).padStart(2, '0')}-${String(ist.getUTCDate()).padStart(2, '0')}`;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return key === '02-28' && !leap ? [key, '02-29'] : [key];
}

function isBirthdayToday(dateOfBirth) {
  if (!dateOfBirth) return false;
  return birthdayKeysToday().includes(String(dateOfBirth).slice(5, 10));
}

function firstPhotoUrl(photos) {
  if (!Array.isArray(photos)) return null;
  const first = photos.find(Boolean);
  if (!first) return null;
  return storageService.getPublicUrl(String(first));
}

function formatUserPreview(user) {
  if (!user) return null;
  const json = user.toJSON ? user.toJSON() : user;
  return {
    id: json.id,
    firstName: json.firstName,
    lastName: json.lastName,
    photoUrl: firstPhotoUrl(json.photos),
    isBirthday: isBirthdayToday(json.dateOfBirth),
  };
}

function otherParticipant(conversation, userId) {
  const json = conversation.toJSON ? conversation.toJSON() : conversation;
  if (String(json.participantOneId) === String(userId)) {
    return json.participantTwo;
  }
  return json.participantOne;
}

function unreadFieldForUser(conversation, userId) {
  if (String(conversation.participantOneId) === String(userId)) {
    return 'participantOneUnreadCount';
  }
  return 'participantTwoUnreadCount';
}

function lastReadFieldForUser(conversation, userId) {
  return String(conversation.participantOneId) === String(userId)
    ? 'participantOneLastReadAt'
    : 'participantTwoLastReadAt';
}

function favoriteFieldForUser(conversation, userId) {
  return String(conversation.participantOneId) === String(userId)
    ? 'participantOneFavoritedAt'
    : 'participantTwoFavoritedAt';
}

function mutedFieldForUser(conversation, userId) {
  return String(conversation.participantOneId) === String(userId)
    ? 'participantOneMutedAt'
    : 'participantTwoMutedAt';
}

function archivedFieldForUser(conversation, userId) {
  return String(conversation.participantOneId) === String(userId)
    ? 'participantOneArchivedAt'
    : 'participantTwoArchivedAt';
}

function peerIdOf(conversation, userId) {
  return String(conversation.participantOneId) === String(userId)
    ? conversation.participantTwoId
    : conversation.participantOneId;
}

function unreadCountForUser(conversation, userId) {
  const field = unreadFieldForUser(conversation, userId);
  return Number(conversation[field] || 0);
}

/** Males need an active subscription to open/send chat; females do not. */
async function getChatAccessForUser(userId) {
  const user = await User.findByPk(userId, { attributes: ['id', 'gender'] });
  if (!user) {
    throw new AppError('User not found', 404);
  }
  if (user.gender !== 'male') {
    return {
      locked: false,
      canOpen: true,
      canSend: true,
      requiresSubscription: false,
      gender: user.gender || null,
    };
  }
  const status = await subscriptionService.getStatus(userId);
  if (status.isActive) {
    return {
      locked: false,
      canOpen: true,
      canSend: true,
      requiresSubscription: false,
      gender: 'male',
    };
  }
  return {
    locked: true,
    canOpen: false,
    canSend: false,
    requiresSubscription: true,
    gender: 'male',
  };
}

const UNLOCKED_BY_PEER = {
  locked: false,
  canOpen: true,
  canSend: true,
  requiresSubscription: false,
  unlockedByPeer: true,
};

async function activeSubscriberIds(userIds) {
  if (!userIds.length) return new Set();
  const rows = await Subscription.findAll({
    where: { userId: userIds, status: 'active', expiresAt: { [Op.gt]: new Date() } },
    attributes: ['userId'],
  });
  return new Set(rows.map((r) => String(r.userId)));
}

/** A subscriber unlocks the whole conversation, so the other person can reply without a plan. */
async function getConversationChatAccess(userId, conversation, baseAccess = null) {
  const access = baseAccess || (await getChatAccessForUser(userId));
  if (!access.locked) return access;
  const peerId = String(peerIdOf(conversation, userId));
  const subscribers = await activeSubscriberIds([peerId]);
  return subscribers.has(peerId) ? { ...access, ...UNLOCKED_BY_PEER } : access;
}

function blurBody(body) {
  const len = Math.min(Math.max(String(body || '').length, 8), 24);
  return '•'.repeat(len);
}

const REPLY_PREVIEW_LENGTH = 160;
const replyToInclude = {
  model: Message,
  as: 'replyTo',
  attributes: ['id', 'senderId', 'body', 'kind', 'e2ee'],
};

/** Short quote of the replied-to message; the body stays encrypted in the DB. */
function formatReplyPreview(reply, locked) {
  if (!reply) return null;
  const json = reply.toJSON ? reply.toJSON() : reply;
  let body = maskChatText(json.body || '');
  if (body.length > REPLY_PREVIEW_LENGTH) body = `${body.slice(0, REPLY_PREVIEW_LENGTH - 1)}…`;
  return {
    id: json.id,
    senderId: json.senderId,
    body: locked ? blurBody(body) : body,
    kind: json.kind || 'text',
    e2ee: locked ? null : json.e2ee || null,
  };
}

function formatConversationListItem(conversation, userId, chatAccess) {
  const json = conversation.toJSON ? conversation.toJSON() : conversation;
  const other = otherParticipant(conversation, userId);
  const lastMessage = json.messages && json.messages.length ? json.messages[0] : null;
  const locked = !!chatAccess?.locked;
  const otherJson = other && other.toJSON ? other.toJSON() : other;
  const mineLast = !!lastMessage && String(lastMessage.senderId) === String(userId);
  // Without the peer's settings loaded we can't tell whether they hide "Seen", so report sent only.
  const receiptsVisible =
    !!otherJson && 'settings' in otherJson && !settingsOf(otherJson).hideReadReceipts;
  const peerReadAt = otherJson ? json[lastReadFieldForUser(json, otherJson.id)] : null;
  const lastSeen =
    mineLast &&
    receiptsVisible &&
    !!peerReadAt &&
    new Date(peerReadAt).getTime() >= new Date(lastMessage.createdAt).getTime();
  return {
    id: json.id,
    lastMessageAt: json.lastMessageAt,
    unreadCount: unreadCountForUser(json, userId),
    isFavorite: !!json[favoriteFieldForUser(json, userId)],
    isMuted: !!json[mutedFieldForUser(json, userId)],
    isArchived: !!json[archivedFieldForUser(json, userId)],
    otherPerson: formatUserPreview(other),
    chatLocked: locked,
    requiresSubscription: !!chatAccess?.requiresSubscription,
    unlockedByPeer: !!chatAccess?.unlockedByPeer,
    lastMessage: lastMessage
      ? {
          id: lastMessage.id,
          body: locked ? blurBody(lastMessage.body) : maskChatText(lastMessage.body),
          e2ee: locked ? null : lastMessage.e2ee || null,
          senderId: lastMessage.senderId,
          createdAt: lastMessage.createdAt,
          status: mineLast ? (lastSeen ? 'seen' : 'sent') : null,
        }
      : null,
  };
}

async function getOrCreateConversation(userId, otherUserId) {
  if (userId === otherUserId) {
    throw new AppError('Cannot start a conversation with yourself', 400);
  }

  const { isBlockedEitherWay } = require('./blockService');
  if (await isBlockedEitherWay(userId, otherUserId)) {
    throw new AppError('Cannot chat with this user', 403);
  }

  const other = await User.findOne({
    where: { id: otherUserId, isActive: true },
  });
  if (!other) {
    throw new AppError('User not found', 404);
  }

  const pair = sortParticipantIds(userId, otherUserId);
  if (!pair) {
    throw new AppError('Cannot start a conversation with yourself', 400);
  }
  const [participantOneId, participantTwoId] = pair;

  let conversation = await Conversation.findOne({
    where: { participantOneId, participantTwoId },
    include: [
      { model: User, as: 'participantOne', attributes: userPreviewAttributes },
      { model: User, as: 'participantTwo', attributes: userPreviewAttributes },
    ],
  });

  if (!conversation) {
    // New social chats require a mutual like
    const { areMatched } = require('./likeService');
    const matched = await areMatched(userId, otherUserId);
    if (!matched) {
      throw new AppError('Like each other to unlock chat', 403);
    }

    conversation = await Conversation.create({
      participantOneId,
      participantTwoId,
      participantOneUnreadCount: 0,
      participantTwoUnreadCount: 0,
    });
    await conversation.reload({
      include: [
        { model: User, as: 'participantOne', attributes: userPreviewAttributes },
        { model: User, as: 'participantTwo', attributes: userPreviewAttributes },
      ],
    });
  }

  const chatAccess = await getConversationChatAccess(userId, conversation);
  return formatConversationListItem(conversation, userId, chatAccess);
}

async function ensureConversationBetween(userIdA, userIdB) {
  const pair = sortParticipantIds(userIdA, userIdB);
  if (!pair) {
    return null;
  }
  const [participantOneId, participantTwoId] = pair;
  let conversation = await Conversation.findOne({
    where: { participantOneId, participantTwoId },
  });
  if (!conversation) {
    conversation = await Conversation.create({
      participantOneId,
      participantTwoId,
      participantOneUnreadCount: 0,
      participantTwoUnreadCount: 0,
    });
  }
  return conversation;
}

function pageLimit(value, fallback, max) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

const LIST_FILTERS = ['all', 'unread', 'favorite', 'birthday', 'archived'];

/** Favorites are a Plus feature. */
async function canFavorite(userId) {
  const status = await subscriptionService.getStatus(userId);
  return !!status.isActive && status.tier === 'plus';
}

/** Archived chats only show under the `archived` filter; every other filter leaves them out. */
function conversationWhere(userId, filter) {
  if (filter === 'archived') {
    return {
      [Op.or]: [
        { participantOneId: userId, participantOneArchivedAt: { [Op.ne]: null } },
        { participantTwoId: userId, participantTwoArchivedAt: { [Op.ne]: null } },
      ],
    };
  }
  const notArchived = {
    [Op.or]: [
      { participantOneId: userId, participantOneArchivedAt: null },
      { participantTwoId: userId, participantTwoArchivedAt: null },
    ],
  };
  return { [Op.and]: [baseConversationWhere(userId, filter), notArchived] };
}

/** Conversations of `userId` narrowed by a list filter; unread/favorite flags are per side. */
function baseConversationWhere(userId, filter) {
  if (filter === 'unread') {
    return {
      [Op.or]: [
        { participantOneId: userId, participantOneUnreadCount: { [Op.gt]: 0 } },
        { participantTwoId: userId, participantTwoUnreadCount: { [Op.gt]: 0 } },
      ],
    };
  }
  if (filter === 'favorite') {
    return {
      [Op.or]: [
        { participantOneId: userId, participantOneFavoritedAt: { [Op.ne]: null } },
        { participantTwoId: userId, participantTwoFavoritedAt: { [Op.ne]: null } },
      ],
    };
  }
  if (filter === 'birthday') {
    const keys = birthdayKeysToday()
      .map((k) => sequelize.escape(k))
      .join(', ');
    const birthdayIds = sequelize.literal(
      `(SELECT u.id FROM users u WHERE to_char(u."dateOfBirth", 'MM-DD') IN (${keys}))`
    );
    return {
      [Op.or]: [
        { participantOneId: userId, participantTwoId: { [Op.in]: birthdayIds } },
        { participantTwoId: userId, participantOneId: { [Op.in]: birthdayIds } },
      ],
    };
  }
  return { [Op.or]: [{ participantOneId: userId }, { participantTwoId: userId }] };
}

/** Badge counts for the list filter chips. */
async function listFilterCounts(userId) {
  const [unread, favorite, birthday, archived] = await Promise.all(
    ['unread', 'favorite', 'birthday', 'archived'].map((f) =>
      Conversation.count({ where: conversationWhere(userId, f) })
    )
  );
  return { unread, favorite, birthday, archived };
}

/** Without `limit` returns the full array (older app builds); with it returns a page. */
async function listConversations(userId, { limit, offset, filter } = {}) {
  const paged = limit != null;
  const size = pageLimit(limit, 20, 50);
  const skip = Math.max(0, parseInt(offset, 10) || 0);
  const listFilter = LIST_FILTERS.includes(filter) ? filter : 'all';
  const [chatAccess, favoritesAllowed, counts] = await Promise.all([
    getChatAccessForUser(userId),
    paged ? canFavorite(userId) : false,
    paged && skip === 0 ? listFilterCounts(userId) : null,
  ]);
  const conversations = await Conversation.findAll({
    ...(paged ? { limit: size + 1, offset: skip } : {}),
    where: conversationWhere(userId, listFilter),
    include: [
      { model: User, as: 'participantOne', attributes: listParticipantAttributes },
      { model: User, as: 'participantTwo', attributes: listParticipantAttributes },
      {
        model: Message,
        as: 'messages',
        separate: true,
        limit: 1,
        order: [['createdAt', 'DESC']],
      },
    ],
    order: [
      [sequelize.literal('"lastMessageAt" DESC NULLS LAST')],
      ['updatedAt', 'DESC'],
    ],
  });

  const hasMore = paged && conversations.length > size;
  const rows = hasMore ? conversations.slice(0, size) : conversations;
  const subscribers = chatAccess.locked
    ? await activeSubscriberIds(rows.map((c) => String(peerIdOf(c, userId))))
    : new Set();
  const items = rows.map((c) =>
    formatConversationListItem(
      c,
      userId,
      subscribers.has(String(peerIdOf(c, userId))) ? { ...chatAccess, ...UNLOCKED_BY_PEER } : chatAccess
    )
  );
  if (!paged) return items;
  return {
    items,
    hasMore,
    nextOffset: hasMore ? skip + size : null,
    filter: listFilter,
    canFavorite: favoritesAllowed,
    ...(counts ? { counts } : {}),
  };
}

async function setFavorite(userId, conversationId, favorite) {
  const conversation = await assertConversationParticipant(conversationId, userId);
  const on = !!favorite;
  if (on && !(await canFavorite(userId))) {
    throw new AppError('Favorite chats are available on the Plus plan', 402, 'PLUS_REQUIRED');
  }
  const field = favoriteFieldForUser(conversation, userId);
  if (!!conversation[field] !== on) {
    await conversation.update({ [field]: on ? new Date() : null });
  }
  return { conversationId: conversation.id, isFavorite: on };
}

async function setMuted(userId, conversationId, muted) {
  const conversation = await assertConversationParticipant(conversationId, userId);
  const on = !!muted;
  const field = mutedFieldForUser(conversation, userId);
  if (!!conversation[field] !== on) {
    await conversation.update({ [field]: on ? new Date() : null });
  }
  return { conversationId: conversation.id, isMuted: on };
}

async function setArchived(userId, conversationId, archived) {
  const conversation = await assertConversationParticipant(conversationId, userId);
  const on = !!archived;
  const field = archivedFieldForUser(conversation, userId);
  if (!!conversation[field] !== on) {
    await conversation.update({ [field]: on ? new Date() : null });
  }
  const { totalUnread } = await getUnreadTotal(userId);
  emitToUser(userId, 'chat:unread', {
    conversationId: conversation.id,
    unreadCount: unreadCountForUser(conversation, userId),
    totalUnread,
  });
  return { conversationId: conversation.id, isArchived: on, totalUnread };
}

async function assertConversationParticipant(conversationId, userId) {
  const conversation = await Conversation.findByPk(conversationId);
  if (!conversation) {
    throw new AppError('Conversation not found', 404);
  }
  const uid = String(userId);
  if (
    String(conversation.participantOneId) !== uid &&
    String(conversation.participantTwoId) !== uid
  ) {
    throw new AppError('Not a participant in this conversation', 403);
  }
  const otherId =
    String(conversation.participantOneId) === uid
      ? conversation.participantTwoId
      : conversation.participantOneId;
  const { isBlockedEitherWay } = require('./blockService');
  if (await isBlockedEitherWay(userId, otherId)) {
    throw new AppError('Conversation is no longer available', 403);
  }
  return conversation;
}

async function getConversation(userId, conversationId) {
  await assertConversationParticipant(conversationId, userId);
  const conversation = await Conversation.findByPk(conversationId, {
    include: [
      { model: User, as: 'participantOne', attributes: userPreviewAttributes },
      { model: User, as: 'participantTwo', attributes: userPreviewAttributes },
      {
        model: Message,
        as: 'messages',
        separate: true,
        limit: 1,
        order: [['createdAt', 'DESC']],
      },
    ],
  });
  const [chatAccess, chatTheme] = await Promise.all([
    getConversationChatAccess(userId, conversation),
    require('./chatThemeService').getThemeState(conversation),
  ]);
  return { ...formatConversationListItem(conversation, userId, chatAccess), chatTheme };
}

async function getUnreadTotal(userId) {
  const conversations = await Conversation.findAll({
    where: {
      [Op.or]: [{ participantOneId: userId }, { participantTwoId: userId }],
    },
    attributes: [
      'id',
      'participantOneId',
      'participantTwoId',
      'participantOneUnreadCount',
      'participantTwoUnreadCount',
      'participantOneArchivedAt',
      'participantTwoArchivedAt',
    ],
  });

  // Archived chats don't count toward the app badge.
  const totalUnread = conversations.reduce(
    (sum, c) => (c[archivedFieldForUser(c, userId)] ? sum : sum + unreadCountForUser(c, userId)),
    0
  );
  return { totalUnread };
}

async function hidesReadReceipts(userId) {
  const user = await User.findByPk(userId, { attributes: ['id', 'settings'] });
  return !!user && settingsOf(user).hideReadReceipts;
}

async function markConversationRead(userId, conversationId, { accessChecked = false } = {}) {
  const conversation = await assertConversationParticipant(conversationId, userId);
  const field = unreadFieldForUser(conversation, userId);
  // Locked chats (no subscription) keep their unread count until the user subscribes.
  if (!accessChecked && (await getConversationChatAccess(userId, conversation)).locked) {
    const { totalUnread } = await getUnreadTotal(userId);
    return { conversationId, unreadCount: unreadCountForUser(conversation, userId), totalUnread };
  }
  const readAt = new Date();
  await conversation.update({ [field]: 0, [lastReadFieldForUser(conversation, userId)]: readAt });
  if (!(await hidesReadReceipts(userId))) {
    emitToUser(peerIdOf(conversation, userId), 'chat:read', { conversationId, userId, readAt });
  }
  const { totalUnread } = await getUnreadTotal(userId);
  emitToUser(userId, 'chat:unread', {
    conversationId,
    unreadCount: 0,
    totalUnread,
  });
  return { conversationId, unreadCount: 0, totalUnread };
}

/**
 * Newest-first pages when `limit` is given (`before` = oldest message id already loaded);
 * items are always returned oldest → newest.
 */
async function listMessages(userId, conversationId, { limit, before } = {}) {
  const conversation = await assertConversationParticipant(conversationId, userId);
  const peerId = peerIdOf(conversation, userId);
  const peerLastReadAt = (await hidesReadReceipts(peerId))
    ? null
    : conversation[lastReadFieldForUser(conversation, peerId)] || null;
  const chatAccess = await getConversationChatAccess(userId, conversation);
  const unreadBeforeOpen = unreadCountForUser(conversation, userId);

  const paged = limit != null;
  const size = pageLimit(limit, 30, 100);
  const where = { conversationId };
  if (paged && before && /^[0-9a-f-]{36}$/i.test(String(before))) {
    const anchor = await Message.findOne({
      where: { id: before, conversationId },
      attributes: ['id', 'createdAt'],
    });
    if (anchor) {
      where[Op.or] = [
        { createdAt: { [Op.lt]: anchor.createdAt } },
        { createdAt: anchor.createdAt, id: { [Op.lt]: anchor.id } },
      ];
    }
  }

  let messages = await Message.findAll({
    where,
    order: paged
      ? [['createdAt', 'DESC'], ['id', 'DESC']]
      : [['createdAt', 'ASC']],
    ...(paged ? { limit: size + 1 } : {}),
    include: [{ model: User, as: 'sender', attributes: userPreviewAttributes }, replyToInclude],
  });
  const hasMore = paged && messages.length > size;
  if (paged) messages = messages.slice(0, size).reverse();

  // Locked males still see listing + counts; opening does not clear unread
  // and bodies stay blurred until they subscribe.
  if (!chatAccess.locked && !before) {
    await markConversationRead(userId, conversationId, { accessChecked: true });
  }

  const items = messages.map((m) => {
    const json = m.toJSON();
    return {
      id: json.id,
      conversationId: json.conversationId,
      senderId: json.senderId,
      body: chatAccess.locked ? blurBody(json.body) : maskChatText(json.body),
      kind: chatAccess.locked ? 'text' : json.kind || 'text',
      meta: chatAccess.locked ? null : json.meta || null,
      e2ee: chatAccess.locked ? null : json.e2ee || null,
      createdAt: json.createdAt,
      updatedAt: json.updatedAt,
      sender: formatUserPreview(json.sender),
      replyTo: formatReplyPreview(m.replyTo, chatAccess.locked),
      clientMessageId: String(json.senderId) === String(userId) ? json.clientMessageId || null : null,
      blurred: !!chatAccess.locked,
    };
  });

  return {
    items,
    hasMore,
    // Unread count as it was before this request marked the chat read (newest page only).
    unreadCount: before ? 0 : unreadBeforeOpen,
    peerLastReadAt,
    chatLocked: !!chatAccess.locked,
    requiresSubscription: !!chatAccess.requiresSubscription,
    canSend: !!chatAccess.canSend,
    unlockedByPeer: !!chatAccess.unlockedByPeer,
  };
}

const CLIENT_MESSAGE_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const MAX_MESSAGE_LENGTH = 4000;

function normalizeClientMessageId(value) {
  if (value == null || value === '') return null;
  const id = String(value);
  if (!CLIENT_MESSAGE_ID_RE.test(id)) throw new AppError('Invalid clientMessageId', 400);
  return id;
}

function elapsedMs(start) {
  return Number(process.hrtime.bigint() - start) / 1e6;
}

/** Throws the first failure in the given order, so error precedence does not depend on timing. */
function firstRejection(results) {
  const failed = results.find((r) => r.status === 'rejected');
  if (failed) throw failed.reason;
  return results.map((r) => r.value);
}

function subscriptionRequiredError() {
  const err = new AppError('Subscribe to unlock chat messaging', 402);
  err.code = 'CHAT_SUBSCRIPTION_REQUIRED';
  return err;
}

/** Same checks as before, run concurrently: participant + block, subscription, suspension (+ reply, moderation). */
async function prepareSend(userId, conversationId, extra = []) {
  const results = await Promise.allSettled([
    assertConversationParticipant(conversationId, userId),
    getChatAccessForUser(userId),
    chatModerationService.assertCanChat(userId),
    ...extra,
  ]);
  const [conversation, baseAccess, , ...rest] = firstRejection(results);
  const chatAccess = await getConversationChatAccess(userId, conversation, baseAccess);
  if (!chatAccess.canSend) throw subscriptionRequiredError();
  return { conversation, rest };
}

function messagePayload(message) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    body: message.body,
    kind: message.kind || 'text',
    meta: message.meta || null,
    e2ee: message.e2ee || null,
    replyTo: formatReplyPreview(message.replyTo, false),
    clientMessageId: message.clientMessageId || null,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}

/**
 * Inserts the message and bumps the counters in one transaction. The recipient's unread count is
 * incremented in SQL so rapid sends can't overwrite each other's increments.
 * Returns null when this sender already stored a message with the same clientMessageId.
 */
async function persistMessage(userId, conversation, fields) {
  const recipientField =
    String(conversation.participantOneId) === String(userId)
      ? 'participantTwoUnreadCount'
      : 'participantOneUnreadCount';
  const senderField = unreadFieldForUser(conversation, userId);
  try {
    return await sequelize.transaction(async (transaction) => {
      const message = await Message.create(
        { ...fields, conversationId: conversation.id, senderId: userId },
        { transaction }
      );
      const [, rows] = await Conversation.update(
        {
          lastMessageAt: new Date(),
          [recipientField]: sequelize.literal(`"${recipientField}" + 1`),
          [senderField]: 0,
        },
        { where: { id: conversation.id }, returning: [recipientField], transaction }
      );
      return { message, recipientUnread: Number(rows?.[0]?.[recipientField]) || 1 };
    });
  } catch (err) {
    if (fields.clientMessageId && err?.name === 'SequelizeUniqueConstraintError') return null;
    throw err;
  }
}

async function findByClientMessageId(userId, conversationId, clientMessageId) {
  const existing = await Message.findOne({
    where: { senderId: userId, clientMessageId },
    include: [replyToInclude],
  });
  if (!existing || String(existing.conversationId) !== String(conversationId)) {
    throw new AppError('clientMessageId was already used for another message', 409);
  }
  return existing;
}

const MODERATION_CATEGORIES = new Set(Object.values(MODERATION_CATEGORY));

/** What the sender's app found when it filtered an encrypted message; never contains text. */
function clientModeration(input) {
  const categories = (Array.isArray(input?.categories) ? input.categories : [])
    .map(String)
    .filter((c) => MODERATION_CATEGORIES.has(c));
  const unique = [...new Set(categories)];
  if (!unique.length) return { flagged: false, categories: [], severity: 0, matchCount: 0 };
  return {
    flagged: true,
    categories: unique,
    severity: Math.min(SEVERITY.CRITICAL, Math.max(SEVERITY.MILD, Number(input.severity) || SEVERITY.MILD)),
    matchCount: Math.min(100, Math.max(1, Number(input.matchCount) || 1)),
  };
}

/**
 * `e2ee`: envelope encrypted on the sender's device. The server stores it as-is and never sees the
 * text, so the sender's app runs the chat filter and reports only the categories it masked.
 */
async function sendMessage(
  userId,
  conversationId,
  body,
  { replyToId, clientMessageId, timings, e2ee, moderation: reportedModeration } = {}
) {
  const started = process.hrtime.bigint();
  const encrypted = e2ee != null;
  const trimmed = !encrypted && body != null ? String(body).trim() : '';
  if (!encrypted && !trimmed) {
    throw new AppError('Message body is required', 400);
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new AppError(`Message is too long (max ${MAX_MESSAGE_LENGTH} characters)`, 400);
  }
  const clientId = normalizeClientMessageId(clientMessageId);
  if (replyToId && !/^[0-9a-f-]{36}$/i.test(String(replyToId))) {
    throw new AppError('Invalid reply message', 400);
  }

  const { conversation, rest } = await prepareSend(userId, conversationId, [
    replyToId
      ? Message.findOne({ where: { id: replyToId, conversationId }, attributes: replyToInclude.attributes })
      : Promise.resolve(null),
    encrypted
      ? e2eeKeyService.validateEnvelope(userId, e2ee)
      : chatModerationService.moderateMessageText(trimmed),
  ]);
  const [replyTo, checked] = rest;
  if (replyToId && !replyTo) throw new AppError('The message you replied to was not found', 404);
  const moderation = encrypted ? clientModeration(reportedModeration) : checked;
  if (timings) timings.checks = elapsedMs(started);

  const persistStart = process.hrtime.bigint();
  const saved = await persistMessage(userId, conversation, {
    body: encrypted ? '' : moderation.masked,
    e2ee: encrypted ? checked : null,
    originalBody: !encrypted && moderation.flagged ? trimmed : null,
    replyToId: replyTo ? replyTo.id : null,
    clientMessageId: clientId,
  });
  if (timings) timings.persist = elapsedMs(persistStart);

  if (!saved) {
    // Retry of a send that already went through: return the stored copy, don't deliver it twice.
    const existing = await findByClientMessageId(userId, conversationId, clientId);
    if (timings) timings.duplicate = true;
    return {
      ...messagePayload(existing),
      body: maskChatText(existing.body),
      moderated: moderation.flagged,
      moderationCategories: moderation.flagged ? moderation.categories : [],
    };
  }

  const { message, recipientUnread } = saved;
  message.replyTo = replyTo;

  if (moderation.flagged) {
    void chatModerationService
      .logModeration({ messageId: message.id, conversationId, senderId: userId, moderation })
      .catch((err) => console.warn('[chat-moderation] log failed', err?.message || err));
  }

  const payload = deliverMessage(userId, conversation, message, recipientUnread);

  return {
    ...payload,
    moderated: moderation.flagged,
    moderationCategories: moderation.flagged ? moderation.categories : [],
  };
}

/** Sends a conversation-game card. Caller has already checked game access. */
async function sendGameMessage(userId, conversationId, { body, meta }) {
  const { conversation } = await prepareSend(userId, conversationId);
  const { message, recipientUnread } = await persistMessage(userId, conversation, {
    body,
    kind: 'game',
    meta,
  });
  return deliverMessage(userId, conversation, message, recipientUnread);
}

/**
 * Emits a message that is already committed. The conversation room gets it right away;
 * the recipient's badge totals and push run in the background so the sender isn't kept waiting.
 */
function deliverMessage(userId, conversation, message, recipientUnread) {
  const conversationId = conversation.id;
  const payload = messagePayload(message);

  emitToConversation(conversationId, 'message:new', payload);

  const recipientId =
    String(conversation.participantOneId) === String(userId)
      ? conversation.participantTwoId
      : conversation.participantOneId;

  void getUnreadTotal(recipientId)
    .then(({ totalUnread }) => {
      emitToUser(recipientId, 'message:new', { ...payload, unreadCount: recipientUnread, totalUnread });
      emitToUser(recipientId, 'chat:unread', { conversationId, unreadCount: recipientUnread, totalUnread });
    })
    .catch((err) => console.warn('[chat] unread emit failed', err?.message || err));

  void sendChatPush({
    senderId: userId,
    recipientId,
    conversation,
    conversationId,
    messageId: message.id,
    body: message.body,
    encrypted: !!message.e2ee,
  }).catch((err) => {
    console.warn('[chat-push] failed', err?.message || err);
  });

  return payload;
}

/** Chat pushes skip the Notification table so the in-app list isn't flooded per message. */
async function sendChatPush({ senderId, recipientId, conversation, conversationId, messageId, body, encrypted }) {
  if (isUserViewingConversation(recipientId, conversationId)) return;
  if (conversation[mutedFieldForUser(conversation, recipientId)]) return;
  if (!(await wantsPush(recipientId, 'chat_message'))) return;
  const tokens = await pushTokenService.listActiveTokensForUser(recipientId);
  if (!tokens.length) return;

  const [sender, recipientAccess] = await Promise.all([
    User.findByPk(senderId, { attributes: ['id', 'firstName', 'lastName'] }),
    getConversationChatAccess(recipientId, conversation),
  ]);
  const senderName =
    [sender?.firstName, sender?.lastName].filter(Boolean).join(' ').trim() || 'New message';
  const text = recipientAccess.locked
    ? 'Sent you a message — subscribe to read it'
    : encrypted
      ? 'New message'
      : body.length > 180
      ? `${body.slice(0, 177)}…`
      : body;

  const messages = tokens.map((row) => ({
    to: row.token,
    sound: 'default',
    title: senderName,
    body: text,
    data: { type: 'chat_message', conversationId, senderId, messageId },
    channelId: 'chat',
    priority: 'high',
  }));

  const result = await sendPushBatch(messages);
  const tickets = Array.isArray(result?.data) ? result.data : [];
  const invalidTokens = tickets
    .map((ticket, i) =>
      ticket?.details?.error === 'DeviceNotRegistered' ? tokens[i]?.token : null
    )
    .filter(Boolean);
  if (invalidTokens.length) {
    await pushTokenService.disableTokens(invalidTokens);
  }

  const tokenByTicket = {};
  tickets.forEach((ticket, i) => {
    if (ticket?.status === 'ok' && ticket.id) tokenByTicket[ticket.id] = tokens[i]?.token;
  });
  scheduleReceiptCheck(Object.keys(tokenByTicket), async (errors) => {
    const dead = errors
      .filter((e) => e.error === 'DeviceNotRegistered')
      .map((e) => tokenByTicket[e.ticketId]);
    if (dead.length) await pushTokenService.disableTokens(dead);
  });
}

/** Every registered device key of both participants, so the sender can encrypt for all of them. */
async function getConversationKeys(userId, conversationId) {
  const conversation = await assertConversationParticipant(conversationId, userId);
  const peerId = peerIdOf(conversation, userId);
  const keys = await e2eeKeyService.keysForUsers([String(userId), String(peerId)]);
  return { me: keys[String(userId)], peer: keys[String(peerId)], peerId: String(peerId) };
}

module.exports = {
  getConversationKeys,
  getOrCreateConversation,
  ensureConversationBetween,
  listConversations,
  getConversation,
  listMessages,
  sendMessage,
  sendGameMessage,
  markConversationRead,
  getUnreadTotal,
  getChatAccessForUser,
  getConversationChatAccess,
  assertConversationParticipant,
  peerIdOf,
  setFavorite,
  setMuted,
  setArchived,
};
