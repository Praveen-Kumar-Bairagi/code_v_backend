const { Op } = require('sequelize');
const { Notification } = require('../../../models');
const AppError = require('../../../utils/AppError');

function formatNotification(row) {
  const json = row.toJSON ? row.toJSON() : row;
  return {
    id: json.id,
    type: json.type,
    title: json.title,
    body: json.body,
    data: json.data || null,
    readAt: json.readAt || null,
    createdAt: json.createdAt,
    updatedAt: json.updatedAt,
  };
}

async function listNotifications(userId, { limit = 50 } = {}) {
  const rows = await Notification.findAll({
    where: { recipientId: userId },
    order: [['createdAt', 'DESC']],
    limit: Math.min(100, Math.max(1, Number(limit) || 50)),
  });

  const unreadCount = await Notification.count({
    where: { recipientId: userId, readAt: null },
  });

  return {
    items: rows.map(formatNotification),
    unreadCount,
  };
}

async function markRead(userId, notificationId) {
  const row = await Notification.findOne({
    where: { id: notificationId, recipientId: userId },
  });
  if (!row) throw new AppError('Notification not found', 404);
  if (!row.readAt) {
    row.readAt = new Date();
    await row.save();
  }
  return formatNotification(row);
}

async function markAllRead(userId) {
  await Notification.update(
    { readAt: new Date() },
    { where: { recipientId: userId, readAt: { [Op.is]: null } } }
  );
  return listNotifications(userId);
}

async function getUnreadCount(userId) {
  const unreadCount = await Notification.count({
    where: { recipientId: userId, readAt: null },
  });
  return { unreadCount };
}

module.exports = {
  listNotifications,
  markRead,
  markAllRead,
  getUnreadCount,
};
