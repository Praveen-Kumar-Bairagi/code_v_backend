'use strict';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const BOOKING_TYPES = new Set([
  'booking_request',
  'booking_accepted',
  'booking_declined',
  'booking_cancelled',
  'booking_reminder',
  'booking_payment',
  'meet_code',
]);

const CHAT_TYPES = new Set(['chat_message', 'new_message']);

function resolveAndroidChannelId(type) {
  const t = String(type || '').toLowerCase();
  if (CHAT_TYPES.has(t) || t.includes('chat') || t.includes('message')) {
    return 'chat';
  }
  if (BOOKING_TYPES.has(t) || t.includes('booking')) {
    return 'bookings';
  }
  return 'default';
}

function buildPushMessage(notification, expoPushToken) {
  const plain =
    typeof notification.toJSON === 'function' ? notification.toJSON() : notification;

  const data = {
    ...(plain.data && typeof plain.data === 'object' ? plain.data : {}),
    notificationId: plain.id,
    type: plain.type,
  };

  return {
    to: expoPushToken,
    sound: 'default',
    title: plain.title,
    body: plain.body,
    data,
    channelId: resolveAndroidChannelId(plain.type),
    priority: 'high',
  };
}

const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const RECEIPT_DELAY_MS = 30 * 1000;

function expoHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
  };
  const accessToken = process.env.EXPO_ACCESS_TOKEN;
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

/**
 * A successful ticket only means Expo accepted the push; delivery problems
 * (e.g. missing FCM credentials, uninstalled app) only show up in receipts.
 * Calls onErrors([{ ticketId, message, error }]) when any receipt failed.
 */
function scheduleReceiptCheck(ticketIds, onErrors) {
  const ids = (ticketIds || []).filter(Boolean);
  if (!ids.length) return;
  const timer = setTimeout(async () => {
    try {
      const response = await fetch(EXPO_RECEIPTS_URL, {
        method: 'POST',
        headers: expoHeaders(),
        body: JSON.stringify({ ids }),
      });
      const body = await response.json().catch(() => ({}));
      const receipts = body?.data && typeof body.data === 'object' ? body.data : {};
      const errors = Object.entries(receipts)
        .filter(([, r]) => r?.status === 'error')
        .map(([ticketId, r]) => ({
          ticketId,
          message: r.message || 'Push delivery failed',
          error: r.details?.error || null,
        }));
      if (errors.length) {
        console.warn(
          '[push] delivery failed:',
          errors.map((e) => `${e.error || ''} ${e.message}`.trim()).join(' | ')
        );
        await onErrors?.(errors);
      }
    } catch (err) {
      console.warn('[push] receipt check failed', err?.message || err);
    }
  }, RECEIPT_DELAY_MS);
  timer.unref?.();
}

async function sendPushBatch(messages) {
  if (!messages.length) return { data: [] };

  const headers = expoHeaders();

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      body?.errors?.[0]?.message || body?.message || `Expo push HTTP ${response.status}`;
    throw new Error(message);
  }

  return body;
}

module.exports = {
  buildPushMessage,
  resolveAndroidChannelId,
  sendPushBatch,
  scheduleReceiptCheck,
};
