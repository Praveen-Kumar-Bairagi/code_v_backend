const { Notification } = require('../../../models');
const { emitToUser } = require('../../../socket/io');
const { sendPushForNotification } = require('./pushNotificationService');

/**
 * Common notification helper — persist + socket emit.
 * Use everywhere bookings/chat/social need to notify a user.
 */
async function emitExistingNotification(notification) {
  const payload =
    typeof notification.toJSON === 'function' ? notification.toJSON() : notification;

  emitToUser(payload.recipientId, 'notification:new', payload);

  void sendPushForNotification(payload).catch(() => {
    /* errors persisted on notification.pushError */
  });

  return payload;
}

async function createAndEmitNotification({
  recipientId,
  type,
  title,
  body,
  data = {},
  transaction,
}) {
  if (!recipientId) return null;

  const notification = await Notification.create(
    {
      recipientId,
      type,
      title: String(title || '').slice(0, 200),
      body: String(body || ''),
      data: data && typeof data === 'object' ? data : {},
    },
    transaction ? { transaction } : undefined
  );

  // Caller emits after commit when inside a transaction
  if (transaction) {
    return notification;
  }

  return emitExistingNotification(notification);
}

async function notifyMany(recipientIds, payloadFactory) {
  const created = [];
  const ids = Array.isArray(recipientIds) ? recipientIds : [];
  for (const recipientId of ids) {
    const payload = await payloadFactory(recipientId);
    if (!payload) continue;
    const row = await createAndEmitNotification({
      recipientId,
      ...payload,
    });
    if (row) created.push(row);
  }
  return created;
}

module.exports = {
  createAndEmitNotification,
  emitExistingNotification,
  notifyMany,
};
