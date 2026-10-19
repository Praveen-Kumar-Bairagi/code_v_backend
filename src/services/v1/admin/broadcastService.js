'use strict';

const { Op } = require('sequelize');
const {
  sequelize,
  User,
  City,
  Notification,
  ExpoPushToken,
  AdminBroadcast,
} = require('../../../models');
const AppError = require('../../../utils/AppError');
const { emitToUser } = require('../../../socket/io');
const {
  buildPushMessage,
  sendPushBatch,
  scheduleReceiptCheck,
} = require('../../expoPushService');
const pushTokenService = require('../user/pushTokenService');

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

function paginationMeta(page, limit, total) {
  return { page, limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / limit) };
}

const NOTIFICATION_TYPE = 'admin_broadcast';
const MODES = ['all', 'filter', 'selected'];
const GENDERS = ['male', 'female', 'other'];
const MAX_SELECTED = 1000;
const USER_CHUNK = 500;
const EXPO_BATCH = 100;

function toList(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((v) => v.trim()).filter(Boolean);
  }
  return [];
}

function normalizeAudience(raw = {}) {
  const mode = MODES.includes(raw.mode) ? raw.mode : 'all';
  const gender = GENDERS.includes(String(raw.gender || '').toLowerCase())
    ? String(raw.gender).toLowerCase()
    : null;
  const cityIds = toList(raw.cityIds);
  const userIds = toList(raw.userIds).slice(0, MAX_SELECTED);
  if (mode === 'filter') return { mode, gender, cityIds };
  if (mode === 'selected') return { mode, userIds };
  return { mode };
}

/** Active users; with pushOnly, only those who left push on and have a registered device. */
function pushReadyWhere(extra = {}, { pushOnly = true } = {}) {
  if (!pushOnly) return { ...extra, isActive: true };
  return {
    ...extra,
    isActive: true,
    [Op.and]: [
      sequelize.literal(`COALESCE(("User"."settings"->>'pushEnabled')::boolean, true) = true`),
      sequelize.literal(
        `EXISTS (SELECT 1 FROM expo_push_tokens t WHERE t."userId" = "User"."id" AND t."disabledAt" IS NULL)`
      ),
    ],
  };
}

function audienceWhere(audience, opts) {
  if (audience.mode === 'selected') {
    return pushReadyWhere({ id: { [Op.in]: audience.userIds } }, opts);
  }
  if (audience.mode === 'filter') {
    const extra = {};
    if (audience.gender) extra.gender = audience.gender;
    if (audience.cityIds.length) extra.cityId = { [Op.in]: audience.cityIds };
    return pushReadyWhere(extra, opts);
  }
  return pushReadyWhere({}, opts);
}

/** Whether a user (plain object with id, gender, cityId) falls inside an audience. */
function userMatchesAudience(rawAudience, user) {
  const audience = normalizeAudience(rawAudience || {});
  if (audience.mode === 'selected') return audience.userIds.includes(String(user.id));
  if (audience.mode === 'filter') {
    if (audience.gender && audience.gender !== user.gender) return false;
    if (audience.cityIds.length && !audience.cityIds.includes(String(user.cityId))) return false;
  }
  return true;
}

function pushOnlyFrom(query) {
  return !(query?.pushOnly === false || query?.pushOnly === 'false' || query?.pushOnly === '0');
}

async function countAudience(rawAudience) {
  const audience = normalizeAudience(rawAudience);
  if (audience.mode === 'selected' && !audience.userIds.length) return { count: 0 };
  const count = await User.count({
    where: audienceWhere(audience, { pushOnly: pushOnlyFrom(rawAudience) }),
  });
  return { count };
}

async function listPushReadyUsers(query = {}) {
  const { page, limit, offset } = parsePagination(query);
  const extra = {};
  const gender = String(query.gender || '').toLowerCase();
  if (GENDERS.includes(gender)) extra.gender = gender;
  if (query.cityId) extra.cityId = String(query.cityId);
  const search = String(query.search || '').trim();
  if (search) {
    extra[Op.or] = [
      { firstName: { [Op.iLike]: `%${search}%` } },
      { lastName: { [Op.iLike]: `%${search}%` } },
      { mobileNumber: { [Op.iLike]: `%${search}%` } },
    ];
  }
  const { rows, count } = await User.findAndCountAll({
    where: pushReadyWhere(extra, { pushOnly: pushOnlyFrom(query) }),
    attributes: ['id', 'firstName', 'lastName', 'mobileNumber', 'gender', 'cityId'],
    include: [{ model: City, as: 'city', attributes: ['id', 'name'] }],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });
  return {
    items: rows.map((u) => ({
      id: u.id,
      name: [u.firstName, u.lastName].filter(Boolean).join(' ').trim(),
      mobileNumber: u.mobileNumber,
      gender: u.gender,
      cityName: u.city?.name || null,
    })),
    pagination: paginationMeta(page, limit, count),
  };
}

async function pushChunk(notifications) {
  const byUser = new Map(notifications.map((n) => [String(n.recipientId), n]));
  const tokens = await ExpoPushToken.findAll({
    where: { userId: { [Op.in]: [...byUser.keys()] }, disabledAt: null },
    attributes: ['userId', 'token'],
  });
  const messages = tokens.map((t) => ({
    token: t.token,
    message: buildPushMessage(byUser.get(String(t.userId)), t.token),
  }));

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < messages.length; i += EXPO_BATCH) {
    const batch = messages.slice(i, i + EXPO_BATCH);
    try {
      const result = await sendPushBatch(batch.map((m) => m.message));
      const tickets = Array.isArray(result?.data) ? result.data : [];
      const dead = [];
      const tokenByTicket = {};
      tickets.forEach((ticket, idx) => {
        if (ticket?.status === 'ok') {
          sent += 1;
          if (ticket.id) tokenByTicket[ticket.id] = batch[idx].token;
          return;
        }
        failed += 1;
        if (ticket?.details?.error === 'DeviceNotRegistered') dead.push(batch[idx].token);
      });
      if (dead.length) await pushTokenService.disableTokens(dead);
      scheduleReceiptCheck(Object.keys(tokenByTicket), async (errors) => {
        const gone = errors
          .filter((e) => e.error === 'DeviceNotRegistered')
          .map((e) => tokenByTicket[e.ticketId]);
        if (gone.length) await pushTokenService.disableTokens(gone);
      });
    } catch (err) {
      failed += batch.length;
      console.warn('[broadcast] push batch failed', err?.message || err);
    }
  }
  return { devices: messages.length, sent, failed };
}

async function deliver(broadcast, audience, { type = NOTIFICATION_TYPE, data = {} } = {}) {
  const where = audienceWhere(audience);
  let lastId = null;
  let recipients = 0;
  let devices = 0;
  let sent = 0;
  let failed = 0;

  // Keyset pagination keeps memory flat for large audiences.
  for (;;) {
    const users = await User.findAll({
      where: lastId ? { ...where, id: { ...(where.id || {}), [Op.gt]: lastId } } : where,
      attributes: ['id'],
      order: [['id', 'ASC']],
      limit: USER_CHUNK,
    });
    if (!users.length) break;
    lastId = users[users.length - 1].id;

    const rows = await Notification.bulkCreate(
      users.map((u) => ({
        recipientId: u.id,
        type,
        title: broadcast.title,
        body: broadcast.body,
        data: { ...data, broadcastId: broadcast.id },
      })),
      { returning: true }
    );
    const plain = rows.map((r) => r.toJSON());
    plain.forEach((n) => emitToUser(n.recipientId, 'notification:new', n));
    recipients += plain.length;

    const result = await pushChunk(plain);
    devices += result.devices;
    sent += result.sent;
    failed += result.failed;

    await broadcast.update({
      recipientCount: recipients,
      deviceCount: devices,
      pushSentCount: sent,
      pushFailedCount: failed,
    });
    if (users.length < USER_CHUNK) break;
  }

  await broadcast.update({ status: 'sent' });
}

/** `notification` lets other features (e.g. vouchers) set the notification type and tap data. */
async function sendBroadcast(adminId, body = {}, notification = {}) {
  const title = String(body.title || '').trim();
  const text = String(body.body || '').trim();
  if (!title) throw new AppError('Title is required', 400);
  if (title.length > 100) throw new AppError('Title must be 100 characters or less', 400);
  if (!text) throw new AppError('Message is required', 400);
  if (text.length > 500) throw new AppError('Message must be 500 characters or less', 400);

  const audience = normalizeAudience(body.audience || {});
  if (audience.mode === 'selected' && !audience.userIds.length) {
    throw new AppError('Select at least one user', 400);
  }
  const { count } = await countAudience(audience);
  if (!count) throw new AppError('No users with push notifications on match this audience', 400);

  const broadcast = await AdminBroadcast.create({
    adminId: adminId || null,
    title,
    body: text,
    audience,
    status: 'sending',
  });

  // Large audiences take a while; the admin page polls history for progress.
  setImmediate(() => {
    deliver(broadcast, audience, notification).catch(async (err) => {
      console.error('[broadcast] failed', err);
      await broadcast.update({ status: 'failed' }).catch(() => {});
    });
  });

  return { ...broadcast.toJSON(), expectedRecipients: count };
}

async function listBroadcasts(query = {}) {
  const { page, limit, offset } = parsePagination(query);
  const { rows, count } = await AdminBroadcast.findAndCountAll({
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });
  const cityIds = [...new Set(rows.flatMap((r) => toList(r.audience?.cityIds)))];
  const cities = cityIds.length
    ? await City.findAll({ where: { id: { [Op.in]: cityIds } }, attributes: ['id', 'name'] })
    : [];
  const cityName = new Map(cities.map((c) => [String(c.id), c.name]));
  return {
    items: rows.map((r) => {
      const json = r.toJSON();
      json.audience = {
        ...json.audience,
        cityNames: toList(json.audience?.cityIds).map((id) => cityName.get(id) || 'Unknown'),
      };
      return json;
    }),
    pagination: paginationMeta(page, limit, count),
  };
}

module.exports = {
  NOTIFICATION_TYPE,
  normalizeAudience,
  userMatchesAudience,
  countAudience,
  listPushReadyUsers,
  sendBroadcast,
  listBroadcasts,
};
