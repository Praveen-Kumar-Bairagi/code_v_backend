'use strict';

const { Notification } = require('../../../models');
const {
  buildPushMessage,
  sendPushBatch,
  scheduleReceiptCheck,
} = require('../../expoPushService');
const pushTokenService = require('./pushTokenService');
const { wantsPush } = require('./settingsService');

async function sendPushForNotification(notification) {
  const plain =
    typeof notification.toJSON === 'function' ? notification.toJSON() : notification;

  if (!plain?.recipientId || !plain?.id) return;
  // In-app notification is still saved; only the phone push is skipped.
  if (!(await wantsPush(plain.recipientId, plain.type))) return;

  const tokens = await pushTokenService.listActiveTokensForUser(plain.recipientId);
  if (!tokens.length) return;

  const messages = tokens.map((row) => buildPushMessage(plain, row.token));

  try {
    const result = await sendPushBatch(messages);
    const tickets = Array.isArray(result?.data) ? result.data : [];

    const invalidTokens = [];
    const ticketErrors = [];
    let firstOkTicketId = null;

    tickets.forEach((ticket, index) => {
      if (ticket?.status === 'error') {
        if (ticket?.message) ticketErrors.push(ticket.message);
        if (ticket?.details?.error === 'DeviceNotRegistered') {
          const tokenRow = tokens[index];
          if (tokenRow?.token) invalidTokens.push(tokenRow.token);
        }
        return;
      }
      if (!firstOkTicketId && ticket?.id) {
        firstOkTicketId = String(ticket.id);
      }
    });

    if (invalidTokens.length) {
      await pushTokenService.disableTokens(invalidTokens);
    }

    const anyDelivered = tickets.some((ticket) => ticket?.status === 'ok');
    const ticketError = ticketErrors.length
      ? ticketErrors.join('; ').slice(0, 2000)
      : null;

    await Notification.update(
      {
        pushSentAt: anyDelivered ? new Date() : null,
        pushTicketId: firstOkTicketId,
        pushError: anyDelivered ? null : ticketError,
      },
      { where: { id: plain.id } }
    );

    const tokenByTicket = {};
    tickets.forEach((ticket, index) => {
      if (ticket?.status === 'ok' && ticket.id) tokenByTicket[ticket.id] = tokens[index]?.token;
    });
    scheduleReceiptCheck(Object.keys(tokenByTicket), async (errors) => {
      const dead = errors
        .filter((e) => e.error === 'DeviceNotRegistered')
        .map((e) => tokenByTicket[e.ticketId]);
      if (dead.length) await pushTokenService.disableTokens(dead);
      const allFailed = errors.length === Object.keys(tokenByTicket).length;
      await Notification.update(
        {
          pushError: errors.map((e) => `${e.error || 'Error'}: ${e.message}`).join('; ').slice(0, 2000),
          ...(allFailed ? { pushSentAt: null } : {}),
        },
        { where: { id: plain.id } }
      );
    });
  } catch (err) {
    await Notification.update(
      {
        pushError: String(err?.message || err).slice(0, 2000),
      },
      { where: { id: plain.id } }
    );
  }
}

module.exports = {
  sendPushForNotification,
};
