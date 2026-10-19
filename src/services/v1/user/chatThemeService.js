const fs = require('fs');
const path = require('path');
const { ChatTheme, Conversation, Message, User, sequelize } = require('../../../models');
const AppError = require('../../../utils/AppError');
const { emitToConversation, emitToUser } = require('../../../socket/io');
const storageService = require('../../storageService');

const UUID_RE = /^[0-9a-f-]{36}$/i;
const HEX_RE = /^#[0-9a-f]{6}$/i;
const KINDS = ['color', 'gradient', 'image'];
const UPLOAD_SUBDIR = 'chat-themes/uploads';

function formatTheme(theme) {
  if (!theme) return null;
  const t = theme.toJSON ? theme.toJSON() : theme;
  return {
    id: t.id,
    name: t.name,
    kind: t.kind,
    color: t.color || null,
    gradientFrom: t.gradientFrom || null,
    gradientTo: t.gradientTo || null,
    imageUrl: t.imageUrl || null,
    isDark: !!t.isDark,
  };
}

/** Theme in effect for a conversation; inactive or missing themes fall back to Default (null). */
function themeState(conversation, theme, setBy) {
  const active = theme && theme.isActive ? theme : null;
  return {
    conversationId: conversation.id,
    theme: formatTheme(active),
    setBy: conversation.chatThemeSetById
      ? { id: conversation.chatThemeSetById, firstName: setBy?.firstName || null }
      : null,
    setAt: conversation.chatThemeSetAt || null,
  };
}

async function getThemeState(conversation) {
  const [theme, setBy] = await Promise.all([
    conversation.chatThemeId ? ChatTheme.findByPk(conversation.chatThemeId) : null,
    conversation.chatThemeSetById
      ? User.findByPk(conversation.chatThemeSetById, { attributes: ['id', 'firstName'] })
      : null,
  ]);
  return themeState(conversation, theme, setBy);
}

function emitThemeState(conversation, state) {
  emitToUser(conversation.participantOneId, 'chat:theme', state);
  emitToUser(conversation.participantTwoId, 'chat:theme', state);
}

async function listActiveThemes() {
  const rows = await ChatTheme.findAll({
    where: { isActive: true },
    order: [['sortOrder', 'ASC'], ['name', 'ASC']],
  });
  return rows.map(formatTheme);
}

/** Either participant can change it; both see it, plus an in-chat note saying who changed it. */
async function setConversationTheme(userId, conversationId, themeId) {
  const chatService = require('./chatService');
  const conversation = await chatService.assertConversationParticipant(conversationId, userId);
  const access = await chatService.getConversationChatAccess(userId, conversation);
  if (!access.canSend) {
    const err = new AppError('Subscribe to unlock chat messaging', 402);
    err.code = 'CHAT_SUBSCRIPTION_REQUIRED';
    throw err;
  }

  let theme = null;
  if (themeId) {
    if (!UUID_RE.test(String(themeId))) throw new AppError('Invalid theme', 400);
    theme = await ChatTheme.findOne({ where: { id: themeId, isActive: true } });
    if (!theme) throw new AppError('This theme is no longer available', 404);
  }

  const currentId = conversation.chatThemeId || null;
  const nextId = theme ? theme.id : null;
  if (String(currentId) === String(nextId)) return getThemeState(conversation);

  const themeName = theme ? theme.name : 'Default';
  const event = await sequelize.transaction(async (transaction) => {
    await conversation.update(
      { chatThemeId: nextId, chatThemeSetById: userId, chatThemeSetAt: new Date() },
      { transaction }
    );
    return Message.create(
      {
        conversationId: conversation.id,
        senderId: userId,
        kind: 'event',
        body: `🎨 Chat theme changed to ${themeName}`,
        meta: { type: 'theme', themeId: nextId, themeName },
      },
      { transaction }
    );
  });

  const setBy = await User.findByPk(userId, { attributes: ['id', 'firstName'] });
  const state = themeState(conversation, theme, setBy);
  emitThemeState(conversation, state);

  // Shown in both chats; not counted as unread and no push.
  const message = {
    id: event.id,
    conversationId: event.conversationId,
    senderId: event.senderId,
    body: event.body,
    kind: 'event',
    meta: event.meta,
    replyTo: null,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
  emitToConversation(conversation.id, 'message:new', message);
  const peerId =
    String(conversation.participantOneId) === String(userId)
      ? conversation.participantTwoId
      : conversation.participantOneId;
  emitToUser(peerId, 'message:new', message);

  return { ...state, message };
}

/** Puts every conversation using this theme back on Default, live on both sides. */
async function resetConversationsUsing(themeId) {
  const conversations = await Conversation.findAll({
    where: { chatThemeId: themeId },
    attributes: ['id', 'participantOneId', 'participantTwoId'],
  });
  if (!conversations.length) return 0;
  const now = new Date();
  await Conversation.update(
    { chatThemeId: null, chatThemeSetById: null, chatThemeSetAt: now },
    { where: { chatThemeId: themeId } }
  );
  conversations.forEach((c) =>
    emitThemeState(c, { conversationId: c.id, theme: null, setBy: null, setAt: now })
  );
  return conversations.length;
}

// ---------- Admin ----------

function parseBool(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return String(value) === 'true' || String(value) === '1';
}

function cleanHex(value, label) {
  if (value === undefined || value === null || value === '') return null;
  const v = String(value).trim();
  if (!HEX_RE.test(v)) throw new AppError(`${label} must be a color like #1E1B4B`, 400);
  return v.toUpperCase();
}

function removeUploadedFile(url) {
  if (!url || !String(url).startsWith(`/public/${UPLOAD_SUBDIR}/`)) return;
  const file = path.join(process.cwd(), String(url).replace(/^\//, ''));
  fs.promises.unlink(file).catch(() => {});
}

async function buildFields(body, file, existing) {
  const fields = {};
  if (body.name !== undefined || !existing) {
    const name = String(body.name || '').trim();
    if (!name) throw new AppError('Name is required', 400);
    if (name.length > 60) throw new AppError('Name is too long (max 60)', 400);
    fields.name = name;
  }
  const kind = body.kind !== undefined ? String(body.kind) : existing?.kind || 'color';
  if (!KINDS.includes(kind)) throw new AppError('Type must be color, gradient or image', 400);
  fields.kind = kind;
  if (body.color !== undefined) fields.color = cleanHex(body.color, 'Color');
  if (body.gradientFrom !== undefined) fields.gradientFrom = cleanHex(body.gradientFrom, 'Gradient start');
  if (body.gradientTo !== undefined) fields.gradientTo = cleanHex(body.gradientTo, 'Gradient end');
  if (body.isDark !== undefined) fields.isDark = parseBool(body.isDark, false);
  if (body.isActive !== undefined) fields.isActive = parseBool(body.isActive, true);
  if (body.sortOrder !== undefined && body.sortOrder !== '') {
    const n = Number(body.sortOrder);
    if (!Number.isInteger(n)) throw new AppError('Sort order must be a whole number', 400);
    fields.sortOrder = n;
  }
  if (file) fields.imageUrl = await storageService.saveProfilePicture(file, UPLOAD_SUBDIR);

  const merged = { ...(existing ? existing.toJSON() : {}), ...fields };
  if (kind === 'color' && !merged.color) throw new AppError('Pick a background color', 400);
  if (kind === 'gradient' && (!merged.gradientFrom || !merged.gradientTo)) {
    throw new AppError('Pick both gradient colors', 400);
  }
  if (kind === 'image' && !merged.imageUrl) throw new AppError('Upload a wallpaper image', 400);
  return fields;
}

async function adminList() {
  const [rows, usage] = await Promise.all([
    ChatTheme.findAll({ order: [['sortOrder', 'ASC'], ['name', 'ASC']] }),
    Conversation.findAll({
      attributes: ['chatThemeId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      where: { chatThemeId: { [require('sequelize').Op.ne]: null } },
      group: ['chatThemeId'],
      raw: true,
    }),
  ]);
  const counts = Object.fromEntries(usage.map((u) => [u.chatThemeId, Number(u.count) || 0]));
  return rows.map((r) => ({
    ...formatTheme(r),
    sortOrder: r.sortOrder,
    isActive: r.isActive,
    inUse: counts[r.id] || 0,
    createdAt: r.createdAt,
  }));
}

async function adminCreate(body, file) {
  const fields = await buildFields(body, file, null);
  const row = await ChatTheme.create(fields);
  return { ...formatTheme(row), sortOrder: row.sortOrder, isActive: row.isActive, inUse: 0 };
}

async function adminUpdate(id, body, file) {
  if (!UUID_RE.test(String(id))) throw new AppError('Theme not found', 404);
  const row = await ChatTheme.findByPk(id);
  if (!row) throw new AppError('Theme not found', 404);
  const oldImage = row.imageUrl;
  const wasActive = row.isActive;
  const fields = await buildFields(body, file, row);
  await row.update(fields);
  if (fields.imageUrl && oldImage !== fields.imageUrl) removeUploadedFile(oldImage);
  const reset = wasActive && !row.isActive ? await resetConversationsUsing(row.id) : 0;
  return { ...formatTheme(row), sortOrder: row.sortOrder, isActive: row.isActive, resetChats: reset };
}

async function adminRemove(id) {
  if (!UUID_RE.test(String(id))) throw new AppError('Theme not found', 404);
  const row = await ChatTheme.findByPk(id);
  if (!row) throw new AppError('Theme not found', 404);
  const reset = await resetConversationsUsing(row.id);
  await row.destroy();
  removeUploadedFile(row.imageUrl);
  return { id: row.id, resetChats: reset };
}

module.exports = {
  formatTheme,
  getThemeState,
  listActiveThemes,
  setConversationTheme,
  adminList,
  adminCreate,
  adminUpdate,
  adminRemove,
};
