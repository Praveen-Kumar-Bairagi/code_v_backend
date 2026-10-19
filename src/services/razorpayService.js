'use strict';

const crypto = require('crypto');
const env = require('../config/env');
const AppError = require('../utils/AppError');

const API_BASE = 'https://api.razorpay.com/v1';

function isConfigured() {
  return Boolean(env.razorpay.keyId && env.razorpay.keySecret);
}

/** Simulated payments — only when real keys are absent. */
function isTestMode() {
  return env.paymentTestMode && !isConfigured();
}

function isPayoutConfigured() {
  return isConfigured() && Boolean(env.razorpay.payoutAccountNumber);
}

function assertConfigured() {
  if (!isConfigured()) {
    throw new AppError('Online payments are not configured (Razorpay keys missing)', 503);
  }
}

function testId(prefix) {
  return `${prefix}_test_${crypto.randomBytes(7).toString('hex')}`;
}

async function request(method, path, body, { idempotencyKey } = {}) {
  assertConfigured();
  const auth = Buffer.from(`${env.razorpay.keyId}:${env.razorpay.keySecret}`).toString('base64');
  const headers = {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
  };
  if (idempotencyKey) headers['X-Payout-Idempotency'] = idempotencyKey;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.description || `Razorpay request failed (${res.status})`;
    throw new AppError(msg, res.status >= 500 ? 502 : 400);
  }
  return data;
}

function safeEqualHex(a, b) {
  const x = Buffer.from(String(a || ''), 'utf8');
  const y = Buffer.from(String(b || ''), 'utf8');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** amountRupees → paise order */
async function createOrder({ amountRupees, receipt, notes }) {
  if (isTestMode()) {
    return { id: testId('order'), amount: Math.round(Number(amountRupees) * 100), currency: 'INR' };
  }
  return request('POST', '/orders', {
    amount: Math.round(Number(amountRupees) * 100),
    currency: 'INR',
    receipt: String(receipt).slice(0, 40),
    notes: notes || {},
  });
}

function verifyPaymentSignature({ orderId, paymentId, signature }) {
  if (!orderId || !paymentId || !signature) return false;
  const expected = crypto
    .createHmac('sha256', env.razorpay.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return safeEqualHex(expected, signature);
}

function verifyWebhookSignature(rawBody, signature) {
  if (!env.razorpay.webhookSecret || !rawBody || !signature) return false;
  const expected = crypto
    .createHmac('sha256', env.razorpay.webhookSecret)
    .update(rawBody)
    .digest('hex');
  return safeEqualHex(expected, signature);
}

async function fetchPayment(paymentId) {
  return request('GET', `/payments/${encodeURIComponent(paymentId)}`);
}

async function capturePayment(paymentId, amountPaise) {
  return request('POST', `/payments/${encodeURIComponent(paymentId)}/capture`, {
    amount: amountPaise,
    currency: 'INR',
  });
}

/** Ensures the payment is captured; returns the payment entity. */
async function ensureCaptured(paymentId) {
  let payment = await fetchPayment(paymentId);
  if (payment.status === 'authorized') {
    payment = await capturePayment(paymentId, payment.amount);
  }
  return payment;
}

/**
 * RazorpayX: contact → UPI fund account → payout.
 * idempotencyKey guarantees the same withdrawal is never paid twice.
 */
async function createUpiPayout({ amountRupees, upiId, name, mobile, referenceId, idempotencyKey }) {
  if (isTestMode()) {
    return { id: testId('pout'), status: 'processed', utr: `TEST${Date.now()}`, test: true };
  }
  if (!isPayoutConfigured()) {
    throw new AppError('RazorpayX payouts are not configured', 503);
  }
  const contact = await request('POST', '/contacts', {
    name: String(name || 'CompaMeet user').slice(0, 50),
    contact: mobile ? String(mobile) : undefined,
    type: 'customer',
    reference_id: String(referenceId).slice(0, 40),
  });
  const fundAccount = await request('POST', '/fund_accounts', {
    contact_id: contact.id,
    account_type: 'vpa',
    vpa: { address: upiId },
  });
  return request(
    'POST',
    '/payouts',
    {
      account_number: env.razorpay.payoutAccountNumber,
      fund_account_id: fundAccount.id,
      amount: Math.round(Number(amountRupees) * 100),
      currency: 'INR',
      mode: env.razorpay.payoutMode,
      purpose: 'payout',
      queue_if_low_balance: true,
      reference_id: String(referenceId).slice(0, 40),
      narration: 'CompaMeet withdrawal',
    },
    { idempotencyKey }
  );
}

module.exports = {
  isConfigured,
  isTestMode,
  testId,
  isPayoutConfigured,
  createOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  fetchPayment,
  ensureCaptured,
  createUpiPayout,
};
