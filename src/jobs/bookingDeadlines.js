'use strict';

const { Op } = require('sequelize');
const { Booking, BookingRequest, sequelize } = require('../models');
const {
  BOOKING_STATUS,
  BOOKING_REQUEST_STATUS,
  BOOKING_DEADLINE_MS,
} = require('../constants/bookingStatus');
const {
  createAndEmitNotification,
} = require('../services/v1/user/notificationCreateService');
const { emitToUser } = require('../socket/io');

const ACTIVE_REQUEST_STATUSES = [
  BOOKING_REQUEST_STATUS.PENDING,
  BOOKING_REQUEST_STATUS.ACCEPTED,
  BOOKING_REQUEST_STATUS.SELECTED,
];

async function countActiveRequests(bookingId, transaction) {
  return BookingRequest.count({
    where: {
      bookingId,
      status: { [Op.in]: ACTIVE_REQUEST_STATUSES },
    },
    transaction,
  });
}

/**
 * Cancel open bookings that have no remaining pending/accepted/selected requests.
 */
async function cancelOpenBookingIfIdle(
  booking,
  { reason, title, body, now = new Date(), transaction } = {}
) {
  if (
    ![BOOKING_STATUS.PENDING, BOOKING_STATUS.RESPONSES_AVAILABLE].includes(
      booking.status
    )
  ) {
    return false;
  }
  const stillActive = await countActiveRequests(booking.id, transaction);
  if (stillActive > 0) return false;

  booking.status = BOOKING_STATUS.CANCELLED;
  booking.cancelledAt = now;
  booking.cancelReason = reason || 'accept_timeout';
  await booking.save({ transaction });

  await createAndEmitNotification({
    recipientId: booking.senderId,
    type: 'booking_cancelled',
    title: title || 'Booking cancelled',
    body: body || 'No companions remain for this booking.',
    data: { bookingId: booking.id, reason: booking.cancelReason },
    transaction,
  });
  return true;
}

/**
 * Expire overdue accept/payment windows and auto-complete meetup sessions
 * when endsAt has passed. Safe to call frequently (idempotent).
 */
async function expireBookingDeadlines() {
  const now = new Date();
  const acceptPayCutoff = new Date(now.getTime() - BOOKING_DEADLINE_MS);
  const touchedUsers = new Set();
  const results = {
    expiredRequests: 0,
    cancelledPayments: 0,
    expiredOffers: 0,
    completedSessions: 0,
    idleCancelled: 0,
    scheduledPassedCancelled: 0,
  };

  // 1) Companion did not accept in time
  const overdueRequests = await BookingRequest.findAll({
    where: {
      status: BOOKING_REQUEST_STATUS.PENDING,
      respondBy: { [Op.lt]: now },
    },
    limit: 500,
  });

  for (const req of overdueRequests) {
    req.status = BOOKING_REQUEST_STATUS.EXPIRED;
    req.respondedAt = now;
    await req.save();
    results.expiredRequests += 1;
    touchedUsers.add(req.receiverId);

    const booking = await Booking.findByPk(req.bookingId);
    if (!booking) continue;
    touchedUsers.add(booking.senderId);

    const cancelled = await cancelOpenBookingIfIdle(booking, {
      reason: 'accept_timeout',
      title: 'Booking expired',
      body: 'No one accepted in time. Booking was cancelled.',
      now,
    });
    if (cancelled) results.idleCancelled += 1;
  }

  // 1b) Accepted offer not selected/paid within 1h of accept
  const staleOffers = await BookingRequest.findAll({
    where: {
      status: BOOKING_REQUEST_STATUS.ACCEPTED,
      acceptedAt: { [Op.lt]: acceptPayCutoff },
    },
    limit: 500,
  });

  for (const req of staleOffers) {
    req.status = BOOKING_REQUEST_STATUS.EXPIRED;
    req.respondedAt = now;
    await req.save();
    results.expiredOffers += 1;
    touchedUsers.add(req.receiverId);

    const booking = await Booking.findByPk(req.bookingId);
    if (!booking) continue;
    touchedUsers.add(booking.senderId);

    // Not selected in time — offer timeout (not payment timeout)
    const cancelled = await cancelOpenBookingIfIdle(booking, {
      reason: 'offer_timeout',
      title: 'Booking cancelled',
      body: 'No response was selected within 1 hour of accept.',
      now,
    });
    if (cancelled) results.idleCancelled += 1;
  }

  // 1c) Sweep idle open bookings (all declined / zero active requests)
  const idleBookings = await Booking.findAll({
    where: {
      status: {
        [Op.in]: [BOOKING_STATUS.PENDING, BOOKING_STATUS.RESPONSES_AVAILABLE],
      },
    },
    limit: 200,
  });

  for (const booking of idleBookings) {
    const requestCount = await BookingRequest.count({
      where: { bookingId: booking.id },
    });
    // Zero requests ever created (orphan) or all inactive
    const cancelled = await cancelOpenBookingIfIdle(booking, {
      reason: requestCount === 0 ? 'no_recipients' : 'all_declined',
      title: 'Booking cancelled',
      body:
        requestCount === 0
          ? 'No companions were available for this booking.'
          : 'All companions declined. Booking was cancelled.',
      now,
    });
    if (cancelled) {
      results.idleCancelled += 1;
      touchedUsers.add(booking.senderId);
    }
  }

  // 1d) Meetup time passed but still open (nobody accepted / not confirmed)
  // pending | responses_available | payment_pending | legacy accepted
  const pastScheduleOpen = await Booking.findAll({
    where: {
      status: {
        [Op.in]: [
          BOOKING_STATUS.PENDING,
          BOOKING_STATUS.RESPONSES_AVAILABLE,
          BOOKING_STATUS.PAYMENT_PENDING,
          BOOKING_STATUS.ACCEPTED,
        ],
      },
      scheduledAt: { [Op.lt]: now },
    },
    limit: 200,
  });

  for (const booking of pastScheduleOpen) {
    const hadAccept =
      booking.status === BOOKING_STATUS.RESPONSES_AVAILABLE ||
      booking.status === BOOKING_STATUS.PAYMENT_PENDING ||
      booking.status === BOOKING_STATUS.ACCEPTED ||
      !!booking.receiverId;

    await sequelize.transaction(async (transaction) => {
      booking.status = BOOKING_STATUS.CANCELLED;
      booking.cancelledAt = now;
      booking.cancelReason = hadAccept
        ? 'scheduled_passed'
        : 'no_accept_before_meet';
      if (booking.paymentStatus === 'unpaid' || !booking.paidAt) {
        booking.paymentStatus = 'unpaid';
      }
      booking.paymentDueAt = null;
      await booking.save({ transaction });

      await BookingRequest.update(
        {
          status: BOOKING_REQUEST_STATUS.EXPIRED,
          respondedAt: now,
        },
        {
          where: {
            bookingId: booking.id,
            status: { [Op.in]: ACTIVE_REQUEST_STATUSES },
          },
          transaction,
        }
      );
    });

    results.scheduledPassedCancelled += 1;
    touchedUsers.add(booking.senderId);
    if (booking.receiverId) touchedUsers.add(booking.receiverId);

    const payload = {
      bookingId: booking.id,
      reason: booking.cancelReason,
    };
    const bodyForSender = hadAccept
      ? 'Meetup time passed before the booking was confirmed. It was cancelled.'
      : 'Meetup time passed and no one accepted. Booking was cancelled.';

    await createAndEmitNotification({
      recipientId: booking.senderId,
      type: 'booking_cancelled',
      title: 'Booking cancelled',
      body: bodyForSender,
      data: payload,
    });

    // Notify companions who still had an open request / were selected
    if (booking.receiverId) {
      await createAndEmitNotification({
        recipientId: booking.receiverId,
        type: 'booking_cancelled',
        title: 'Booking cancelled',
        body: 'Meetup time passed before confirmation. Booking was cancelled.',
        data: payload,
      });
    } else {
      const reqReceivers = await BookingRequest.findAll({
        where: { bookingId: booking.id },
        attributes: ['receiverId'],
        limit: 100,
      });
      const seen = new Set();
      for (const r of reqReceivers) {
        if (!r.receiverId || seen.has(r.receiverId)) continue;
        seen.add(r.receiverId);
        touchedUsers.add(r.receiverId);
        await createAndEmitNotification({
          recipientId: r.receiverId,
          type: 'booking_cancelled',
          title: 'Booking cancelled',
          body: 'Meetup time passed with no confirmation. This request was closed.',
          data: payload,
        });
      }
    }

    emitToUser(booking.senderId, 'booking:updated', payload);
    if (booking.receiverId) {
      emitToUser(booking.receiverId, 'booking:updated', payload);
    }
  }

  // 2) Sender did not pay in time (payment_pending)
  const overduePayments = await Booking.findAll({
    where: {
      status: BOOKING_STATUS.PAYMENT_PENDING,
      paymentDueAt: { [Op.lt]: now },
    },
    limit: 200,
  });

  for (const booking of overduePayments) {
    await sequelize.transaction(async (transaction) => {
      booking.status = BOOKING_STATUS.CANCELLED;
      booking.cancelledAt = now;
      booking.cancelReason = 'payment_timeout';
      booking.paymentStatus = 'unpaid';
      await booking.save({ transaction });

      await BookingRequest.update(
        {
          status: BOOKING_REQUEST_STATUS.EXPIRED,
          respondedAt: now,
        },
        {
          where: {
            bookingId: booking.id,
            status: { [Op.in]: ACTIVE_REQUEST_STATUSES },
          },
          transaction,
        }
      );
    });

    results.cancelledPayments += 1;
    touchedUsers.add(booking.senderId);
    if (booking.receiverId) touchedUsers.add(booking.receiverId);

    const payload = {
      bookingId: booking.id,
      reason: 'payment_timeout',
    };

    await createAndEmitNotification({
      recipientId: booking.senderId,
      type: 'booking_cancelled',
      title: 'Booking cancelled',
      body: 'Payment was not completed in time.',
      data: payload,
    });
    if (booking.receiverId) {
      await createAndEmitNotification({
        recipientId: booking.receiverId,
        type: 'booking_cancelled',
        title: 'Booking cancelled',
        body: 'Sender did not pay in time. Booking was cancelled.',
        data: payload,
      });
    }
  }

  // 3) Meetup session ended — auto complete
  const overdueSessions = await Booking.findAll({
    where: {
      status: BOOKING_STATUS.IN_PROGRESS,
      endsAt: { [Op.lt]: now },
    },
    limit: 200,
  });

  for (const booking of overdueSessions) {
    booking.status = BOOKING_STATUS.COMPLETED;
    await booking.save();
    results.completedSessions += 1;

    touchedUsers.add(booking.senderId);
    if (booking.receiverId) touchedUsers.add(booking.receiverId);

    const payload = { bookingId: booking.id, reason: 'session_ended' };
    await createAndEmitNotification({
      recipientId: booking.senderId,
      type: 'booking_completed',
      title: 'Meetup completed',
      body: 'Your meetup session has ended. Hope it went well!',
      data: payload,
    });
    if (booking.receiverId) {
      await createAndEmitNotification({
        recipientId: booking.receiverId,
        type: 'booking_completed',
        title: 'Meetup completed',
        body: 'Your meetup session has ended. Hope it went well!',
        data: payload,
      });
    }
    emitToUser(booking.senderId, 'booking:updated', payload);
    if (booking.receiverId) {
      emitToUser(booking.receiverId, 'booking:updated', payload);
    }
  }

  for (const userId of touchedUsers) {
    emitToUser(userId, 'booking:updated', {
      reason: 'deadline_expired',
      bookingId: null,
    });
  }

  return results;
}

let timer = null;

function startBookingDeadlineJob({ intervalMs = 30_000 } = {}) {
  if (timer) return;
  const tick = async () => {
    try {
      await expireBookingDeadlines();
    } catch (err) {
      console.error('[booking-deadlines]', err.message || err);
    }
  };
  tick();
  timer = setInterval(tick, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
}

function stopBookingDeadlineJob() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = {
  expireBookingDeadlines,
  startBookingDeadlineJob,
  stopBookingDeadlineJob,
  cancelOpenBookingIfIdle,
};
