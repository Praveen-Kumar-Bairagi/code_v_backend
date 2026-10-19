'use strict';

const BOOKING_STATUS = {
  PENDING: 'pending',
  RESPONSES_AVAILABLE: 'responses_available',
  PAYMENT_PENDING: 'payment_pending',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  ACCEPTED: 'accepted', // legacy / direct
  DECLINED: 'declined',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
};

const BOOKING_STATUS_VALUES = Object.values(BOOKING_STATUS);

const BOOKING_REQUEST_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  CANCELLED: 'cancelled',
  SELECTED: 'selected',
  EXPIRED: 'expired',
};

const BOOKING_REQUEST_STATUS_VALUES = Object.values(BOOKING_REQUEST_STATUS);

const BOOKING_AMOUNT = {
  DEFAULT: 99,
  MIN: 99,
  MAX: 1500,
};

/** 1 hour windows: companion accept, then sender pay */
const BOOKING_DEADLINE_MS = 60 * 60 * 1000;

module.exports = {
  BOOKING_STATUS,
  BOOKING_STATUS_VALUES,
  BOOKING_REQUEST_STATUS,
  BOOKING_REQUEST_STATUS_VALUES,
  BOOKING_AMOUNT,
  BOOKING_DEADLINE_MS,
};
