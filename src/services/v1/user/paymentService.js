'use strict';

const { CoinPack, PaymentOrder, User, sequelize } = require('../../../models');
const AppError = require('../../../utils/AppError');
const env = require('../../../config/env');
const razorpay = require('../../razorpayService');
const subscriptionService = require('./subscriptionService');
const bookingService = require('./bookingService');
const walletService = require('./walletService');
const coinService = require('./coinService');
const voucherService = require('./voucherService');

const PURPOSE = {
  SUBSCRIPTION: 'subscription',
  BOOKING: 'booking',
  WALLET_TOPUP: 'wallet_topup',
  COIN_PACK: 'coin_pack',
};
const STATUS = { CREATED: 'created', PAID: 'paid', FAILED: 'failed' };

function sanitizeReturnUrl(url) {
  const value = String(url || '').trim();
  if (!value) return null;
  return env.paymentReturnUrlPrefixes.some((p) => value.startsWith(p)) ? value.slice(0, 500) : null;
}

function formatOrder(order) {
  return {
    id: order.id,
    purpose: order.purpose,
    referenceId: order.referenceId,
    amount: order.amount,
    currency: order.currency,
    status: order.status,
    razorpayOrderId: order.razorpayOrderId,
    failureReason: order.failureReason || null,
    paidAt: order.paidAt || null,
    checkoutUrl: `${env.publicApiUrl}/api/v1/payments/checkout/${order.id}`,
    keyId: env.razorpay.keyId,
    testMode: Boolean(order.meta?.testMode),
    voucherCode: order.meta?.voucherCode || null,
    discountRupees: order.meta?.discountRupees || 0,
  };
}

async function createOrder({ userId, purpose, referenceId, amount, description, returnUrl, meta = {} }) {
  const rzpOrder = await razorpay.createOrder({
    amountRupees: amount,
    receipt: `${purpose.slice(0, 3)}_${Date.now()}`,
    notes: { userId, purpose, referenceId },
  });
  const order = await PaymentOrder.create({
    userId,
    purpose,
    referenceId,
    amount,
    status: STATUS.CREATED,
    razorpayOrderId: rzpOrder.id,
    returnUrl: sanitizeReturnUrl(returnUrl),
    meta: { ...meta, description, testMode: razorpay.isTestMode() },
  });
  return formatOrder(order);
}

async function createWalletTopupOrder(userId, { amount, returnUrl } = {}) {
  const amt = walletService.assertTopUpAmount(amount);
  return createOrder({
    userId,
    purpose: PURPOSE.WALLET_TOPUP,
    referenceId: userId,
    amount: amt,
    description: `Wallet recharge ₹${amt}`,
    returnUrl,
  });
}

async function voucherPricing(userId, voucherCode, quote) {
  if (!String(voucherCode || '').trim()) return { amount: quote.priceRupees, meta: {} };
  const q = await voucherService.quoteDiscount(userId, { code: voucherCode, ...quote });
  return {
    amount: q.finalRupees,
    meta: {
      voucherId: q.voucherId,
      voucherCode: q.voucherCode,
      voucherItemName: q.itemName,
      originalAmount: q.originalRupees,
      discountRupees: q.discountRupees,
    },
  };
}

async function createSubscriptionOrder(userId, { planId, returnUrl, voucherCode } = {}) {
  const plan = await subscriptionService.resolvePlanForPurchase(planId);
  const pricing = await voucherPricing(userId, voucherCode, {
    appliesTo: 'subscription',
    itemId: plan.id,
    priceRupees: plan.priceRupees,
    itemName: plan.name,
  });
  return createOrder({
    userId,
    purpose: PURPOSE.SUBSCRIPTION,
    referenceId: plan.id,
    amount: pricing.amount,
    description: `${plan.name} subscription · ${plan.durationDays} days`,
    returnUrl,
    meta: pricing.meta,
  });
}

async function createCoinPackOrder(userId, { packId, returnUrl, voucherCode } = {}) {
  const pack = await coinService.resolvePackForPurchase(packId);
  const pricing = await voucherPricing(userId, voucherCode, {
    appliesTo: 'coins',
    itemId: pack.id,
    priceRupees: pack.priceRupees,
    itemName: `${pack.coins} coins`,
  });
  return createOrder({
    userId,
    purpose: PURPOSE.COIN_PACK,
    referenceId: pack.id,
    amount: pricing.amount,
    description: `${pack.coins} Compameet coins`,
    returnUrl,
    meta: { coins: pack.coins, ...pricing.meta },
  });
}

async function createBookingOrder(userId, { bookingId, returnUrl } = {}) {
  const booking = await bookingService.getPayableBooking(userId, bookingId);
  return createOrder({
    userId,
    purpose: PURPOSE.BOOKING,
    referenceId: booking.id,
    amount: Number(booking.amount),
    description: 'Booking payment',
    returnUrl,
  });
}

/**
 * Marks the order paid and applies its effect (activate plan / confirm booking).
 * Idempotent — callback, verify API and webhook may all call it for the same payment.
 */
async function fulfillOrder(razorpayOrderId, { paymentId, signature, simulated = false } = {}) {
  const payment = paymentId && !simulated ? await razorpay.ensureCaptured(paymentId) : null;
  if (payment && payment.order_id !== razorpayOrderId) {
    throw new AppError('Payment does not belong to this order', 400);
  }
  if (payment && payment.status !== 'captured') {
    throw new AppError(`Payment not captured (status: ${payment.status})`, 400);
  }

  let bookingConfirmed = null;
  const order = await sequelize.transaction(async (transaction) => {
    const row = await PaymentOrder.findOne({
      where: { razorpayOrderId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!row) throw new AppError('Payment order not found', 404);
    if (row.status === STATUS.PAID) return row;

    if (payment && Math.round(Number(payment.amount)) !== row.amount * 100) {
      throw new AppError('Paid amount does not match order amount', 400);
    }

    row.status = STATUS.PAID;
    row.paidAt = new Date();
    row.failureReason = null;
    if (paymentId) row.razorpayPaymentId = paymentId;
    if (signature) row.razorpaySignature = signature;

    if (row.purpose === PURPOSE.SUBSCRIPTION) {
      const plan = await subscriptionService.resolvePlanForPurchase(row.referenceId);
      await subscriptionService.activatePlan(row.userId, plan, {
        paymentMethod: 'razorpay',
        transaction,
      });
    } else if (row.purpose === PURPOSE.BOOKING) {
      const ok = await bookingService.confirmPaidOnline(row.userId, row.referenceId, {
        transaction,
        razorpayPaymentId: paymentId,
        paymentOrderId: row.id,
      });
      if (ok) {
        bookingConfirmed = row.referenceId;
      } else {
        // Booking expired/cancelled while paying → money goes to wallet
        await walletService.createLedgerEntry({
          userId: row.userId,
          type: walletService.WALLET_TX_TYPES.REFUND,
          direction: 'credit',
          amount: row.amount,
          title: 'Booking payment refunded',
          body: `₹${row.amount} added to wallet — booking was no longer awaiting payment`,
          bookingId: row.referenceId,
          idempotencyKey: `razorpay_refund:${row.id}`,
          meta: { razorpayPaymentId: paymentId, withdrawable: false },
          transaction,
        });
        row.meta = { ...(row.meta || {}), refundedToWallet: true };
      }
    } else if (row.purpose === PURPOSE.COIN_PACK) {
      const pack = await CoinPack.findByPk(row.referenceId, { transaction });
      const coins = row.meta?.coins ?? pack?.coins;
      if (!coins) throw new AppError('Coin pack not found', 404);
      await coinService.applyChange(
        row.userId,
        {
          amount: coins,
          type: coinService.COIN_TX_TYPES.PURCHASE,
          title: `Bought ${coins} coins`,
          referenceId: row.id,
          idempotencyKey: `coin_purchase:${row.id}`,
          meta: { priceRupees: row.amount, razorpayPaymentId: paymentId || null },
        },
        { transaction }
      );
    } else if (row.purpose === PURPOSE.WALLET_TOPUP) {
      await walletService.creditTopUp(row.userId, row.amount, {
        transaction,
        idempotencyKey: `razorpay_topup:${row.id}`,
        meta: { source: simulated ? 'test' : 'razorpay', razorpayPaymentId: paymentId, paymentOrderId: row.id },
      });
    }

    await voucherService.recordOrderRedemption(row, { transaction });
    await row.save({ transaction });
    return row;
  });

  if (bookingConfirmed) {
    await bookingService.notifyBookingConfirmed(bookingConfirmed, order.userId).catch((err) =>
      console.error('notifyBookingConfirmed failed', err)
    );
  }
  return order;
}

async function markFailed(razorpayOrderId, reason) {
  const row = await PaymentOrder.findOne({ where: { razorpayOrderId } });
  if (!row || row.status === STATUS.PAID) return row;
  row.status = STATUS.FAILED;
  row.failureReason = String(reason || 'Payment failed').slice(0, 500);
  await row.save();
  return row;
}

/** App/web verify after checkout (signature from Razorpay handler). */
async function verifyCheckout(userId, { razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  const ok = razorpay.verifyPaymentSignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });
  if (!ok) throw new AppError('Invalid payment signature', 400);

  const existing = await PaymentOrder.findOne({ where: { razorpayOrderId: razorpay_order_id } });
  if (!existing || existing.userId !== userId) throw new AppError('Payment order not found', 404);

  const order = await fulfillOrder(razorpay_order_id, {
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });
  return formatOrder(order);
}

/** Razorpay redirect (callback_url) — form POST with payment fields or error fields. */
async function handleCallback(body = {}) {
  const orderId = body.razorpay_order_id;
  let order = null;

  if (body.test_outcome) {
    if (!razorpay.isTestMode()) throw new AppError('Test payments are disabled', 400);
    const row = await PaymentOrder.findOne({ where: { razorpayOrderId: orderId } });
    if (!row || !row.meta?.testMode) throw new AppError('Payment order not found', 404);
    if (body.test_outcome === 'success') {
      return fulfillOrder(orderId, { paymentId: razorpay.testId('pay'), simulated: true });
    }
    return markFailed(orderId, 'Payment cancelled (test mode)');
  }

  if (body.razorpay_payment_id && body.razorpay_signature) {
    const ok = razorpay.verifyPaymentSignature({
      orderId: body.razorpay_order_id,
      paymentId: body.razorpay_payment_id,
      signature: body.razorpay_signature,
    });
    if (!ok) throw new AppError('Invalid payment signature', 400);
    order = await fulfillOrder(body.razorpay_order_id, {
      paymentId: body.razorpay_payment_id,
      signature: body.razorpay_signature,
    });
  } else {
    const err = body.error || {};
    let meta = err.metadata ?? body['error[metadata]'];
    if (typeof meta === 'string') {
      try {
        meta = JSON.parse(meta);
      } catch {
        meta = null;
      }
    }
    const failedOrderId = orderId || meta?.order_id;
    if (failedOrderId) {
      order = await markFailed(
        failedOrderId,
        err.description || body['error[description]'] || 'Payment cancelled'
      );
    }
  }
  return order;
}

/** Razorpay webhook — source of truth if the app/browser closes mid-payment. */
async function handleWebhook(rawBody, signature) {
  if (!razorpay.verifyWebhookSignature(rawBody, signature)) {
    throw new AppError('Invalid webhook signature', 400);
  }
  const event = JSON.parse(rawBody.toString('utf8'));
  const type = event.event;
  const paymentEntity = event.payload?.payment?.entity;
  const orderEntity = event.payload?.order?.entity;
  const payoutEntity = event.payload?.payout?.entity;

  if (type === 'payment.captured' || type === 'order.paid') {
    const orderId = paymentEntity?.order_id || orderEntity?.id;
    if (orderId && (await PaymentOrder.count({ where: { razorpayOrderId: orderId } }))) {
      await fulfillOrder(orderId, { paymentId: paymentEntity?.id });
    }
  } else if (type === 'payment.failed') {
    if (paymentEntity?.order_id) {
      await markFailed(
        paymentEntity.order_id,
        paymentEntity.error_description || 'Payment failed'
      );
    }
  } else if (type && type.startsWith('payout.') && payoutEntity) {
    await walletService.applyPayoutUpdate(payoutEntity);
  }
  return { received: true, event: type };
}

async function getOrder(userId, id) {
  const order = await PaymentOrder.findByPk(id);
  if (!order || order.userId !== userId) throw new AppError('Payment order not found', 404);
  return formatOrder(order);
}

/** Public (no auth) — data for the hosted checkout page. Order id is an unguessable UUID. */
async function getCheckoutData(id) {
  const order = await PaymentOrder.findByPk(id, {
    include: [{ model: User, as: 'user', attributes: ['firstName', 'lastName', 'mobileNumber', 'email'] }],
  });
  if (!order) throw new AppError('Payment order not found', 404);
  return {
    order,
    keyId: env.razorpay.keyId,
    brandName: env.razorpay.brandName,
    testMode: Boolean(order.meta?.testMode) && razorpay.isTestMode(),
    callbackUrl: `${env.publicApiUrl}/api/v1/payments/razorpay/callback`,
  };
}

function buildReturnUrl(order, status) {
  if (!order?.returnUrl) return null;
  const sep = order.returnUrl.includes('?') ? '&' : '?';
  return `${order.returnUrl}${sep}status=${encodeURIComponent(status)}&orderId=${encodeURIComponent(order.id)}`;
}

module.exports = {
  PURPOSE,
  STATUS,
  createSubscriptionOrder,
  createCoinPackOrder,
  createBookingOrder,
  createWalletTopupOrder,
  verifyCheckout,
  handleCallback,
  handleWebhook,
  getOrder,
  getCheckoutData,
  buildReturnUrl,
};
