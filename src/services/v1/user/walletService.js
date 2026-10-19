'use strict';

const { Op } = require('sequelize');
const {
  User,
  WalletTransaction,
  WithdrawalRequest,
  sequelize,
} = require('../../../models');
const AppError = require('../../../utils/AppError');
const razorpay = require('../../razorpayService');

const WALLET_TX_TYPES = {
  TOP_UP: 'top_up',
  BOOKING_PAYMENT: 'booking_payment',
  BOOKING_EARNING: 'booking_earning',
  WITHDRAWAL: 'withdrawal',
  REFUND: 'refund',
};

const WITHDRAWAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

function formatTx(row) {
  const json = row.toJSON ? row.toJSON() : row;
  return {
    id: json.id,
    type: json.type,
    direction: json.direction,
    amount: json.amount,
    balanceAfter: json.balanceAfter,
    title: json.title,
    body: json.body || null,
    bookingId: json.bookingId || null,
    meta: json.meta || null,
    createdAt: json.createdAt,
  };
}

function formatWithdrawal(row) {
  const json = row.toJSON ? row.toJSON() : row;
  const user = json.user
    ? {
        id: json.user.id,
        firstName: json.user.firstName,
        lastName: json.user.lastName,
        mobileNumber: json.user.mobileNumber,
        upiId: json.user.upiId || null,
      }
    : null;
  return {
    id: json.id,
    userId: json.userId,
    amount: json.amount,
    status: json.status,
    upiId: json.upiId || null,
    note: json.note || null,
    adminNote: json.adminNote || null,
    reviewedByAdminId: json.reviewedByAdminId || null,
    reviewedAt: json.reviewedAt || null,
    walletTransactionId: json.walletTransactionId || null,
    payoutId: json.payoutId || null,
    payoutStatus: json.payoutStatus || null,
    payoutUtr: json.payoutUtr || null,
    payoutFailureReason: json.payoutFailureReason || null,
    createdAt: json.createdAt,
    updatedAt: json.updatedAt,
    user,
  };
}

async function sumAmount(where, transaction) {
  const total = await WalletTransaction.sum('amount', { where, transaction });
  return Number(total || 0);
}

/** Only meetup earnings can be withdrawn — not top-ups */
async function getWithdrawableBreakdown(userId, { transaction } = {}) {
  const earned = await sumAmount(
    {
      userId,
      type: WALLET_TX_TYPES.BOOKING_EARNING,
      direction: 'credit',
    },
    transaction
  );
  const withdrawnDebits = await sumAmount(
    {
      userId,
      type: WALLET_TX_TYPES.WITHDRAWAL,
      direction: 'debit',
    },
    transaction
  );
  // Failed/reversed payouts are credited back as withdrawal credits
  const withdrawnReversed = await sumAmount(
    {
      userId,
      type: WALLET_TX_TYPES.WITHDRAWAL,
      direction: 'credit',
    },
    transaction
  );
  const withdrawn = Math.max(0, withdrawnDebits - withdrawnReversed);
  const pendingSum = await WithdrawalRequest.sum('amount', {
    where: { userId, status: WITHDRAWAL_STATUS.PENDING },
    transaction,
  });
  const pending = Number(pendingSum || 0);
  const withdrawable = Math.max(0, earned - withdrawn - pending);
  return { earned, withdrawn, pending, withdrawable };
}

async function getWallet(userId) {
  const user = await User.findByPk(userId, {
    attributes: ['id', 'walletBalance', 'upiId'],
  });
  if (!user) throw new AppError('User not found', 404);
  const breakdown = await getWithdrawableBreakdown(userId);
  const balance = Number(user.walletBalance || 0);
  return {
    balance,
    currency: 'INR',
    withdrawable: Math.min(breakdown.withdrawable, balance),
    earned: breakdown.earned,
    withdrawn: breakdown.withdrawn,
    pendingWithdrawal: breakdown.pending,
    topUpLocked: Math.max(0, balance - Math.min(breakdown.withdrawable, balance)),
    upiId: user.upiId || null,
  };
}

async function listTransactions(userId, { limit = 50, offset = 0 } = {}) {
  const take = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const skip = Math.max(Number(offset) || 0, 0);

  const { rows, count } = await WalletTransaction.findAndCountAll({
    where: { userId },
    order: [['createdAt', 'DESC']],
    limit: take,
    offset: skip,
  });

  const wallet = await getWallet(userId);
  return {
    ...wallet,
    items: rows.map(formatTx),
    total: count,
    limit: take,
    offset: skip,
  };
}

async function createLedgerEntry({
  userId,
  type,
  direction,
  amount,
  title,
  body,
  bookingId,
  idempotencyKey,
  meta,
  affectsBalance = true,
  transaction: outerTx,
} = {}) {
  const amt = Math.round(Number(amount));
  if (!Number.isFinite(amt) || amt < 1) {
    throw new AppError('Invalid wallet amount', 400);
  }
  if (!['credit', 'debit'].includes(direction)) {
    throw new AppError('Invalid wallet direction', 400);
  }

  const run = async (transaction) => {
    if (idempotencyKey) {
      const existing = await WalletTransaction.findOne({
        where: { idempotencyKey },
        transaction,
      });
      if (existing) return formatTx(existing);
    }

    const user = await User.findByPk(userId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!user) throw new AppError('User not found', 404);

    let balance = Number(user.walletBalance || 0);
    if (affectsBalance) {
      if (direction === 'credit') {
        balance += amt;
      } else {
        if (balance < amt) {
          throw new AppError('Insufficient wallet balance', 400);
        }
        balance -= amt;
      }
      user.walletBalance = balance;
      await user.save({ transaction });
    }

    const row = await WalletTransaction.create(
      {
        userId,
        type,
        direction,
        amount: amt,
        balanceAfter: balance,
        title: String(title || 'Wallet').slice(0, 200),
        body: body ? String(body).slice(0, 500) : null,
        bookingId: bookingId || null,
        idempotencyKey: idempotencyKey || null,
        meta: meta || null,
      },
      { transaction }
    );

    return formatTx(row);
  };

  if (outerTx) return run(outerTx);
  return sequelize.transaction(run);
}

const TOP_UP_AMOUNTS = [100, 200, 500, 999, 1000, 1500, 2000, 5000];

function assertTopUpAmount(amount) {
  const amt = Math.round(Number(amount));
  if (!TOP_UP_AMOUNTS.includes(amt)) {
    throw new AppError('Choose a valid top-up amount', 400);
  }
  return amt;
}

function creditTopUp(userId, amount, { transaction, idempotencyKey, meta } = {}) {
  return createLedgerEntry({
    userId,
    type: WALLET_TX_TYPES.TOP_UP,
    direction: 'credit',
    amount,
    title: 'Wallet top-up',
    body: `Added ₹${amount} to wallet (not withdrawable)`,
    idempotencyKey,
    meta: { withdrawable: false, ...(meta || {}) },
    affectsBalance: true,
    transaction,
  });
}

/** Direct (unpaid) top-up — test mode only; real money goes through Razorpay orders. */
async function topUp(userId, amount) {
  const amt = assertTopUpAmount(amount);
  if (!razorpay.isTestMode()) {
    throw new AppError('Please add money via online payment', 400);
  }
  return creditTopUp(userId, amt, { meta: { source: 'test' } });
}

async function recordBookingPayment(userId, booking, { transaction } = {}) {
  const amount = Number(booking.amount);
  return createLedgerEntry({
    userId,
    type: WALLET_TX_TYPES.BOOKING_PAYMENT,
    direction: 'debit',
    amount,
    title: 'Booking payment',
    body: `Paid ₹${amount} to confirm booking`,
    bookingId: booking.id,
    idempotencyKey: `booking_payment:${booking.id}:${userId}`,
    meta: { method: 'wallet', status: booking.status },
    affectsBalance: true,
    transaction,
  });
}

async function recordBookingEarning(userId, booking, { transaction } = {}) {
  const amount = Number(booking.amount);
  return createLedgerEntry({
    userId,
    type: WALLET_TX_TYPES.BOOKING_EARNING,
    direction: 'credit',
    amount,
    title: 'Booking earning',
    body: `Earned ₹${amount} after meetup verified`,
    bookingId: booking.id,
    idempotencyKey: `booking_earning:${booking.id}:${userId}`,
    meta: { bookingStatus: booking.status, withdrawable: true },
    affectsBalance: true,
    transaction,
  });
}

/** Refund creator payment if booking cancelled after pay (before/without companion earning). */
async function refundBookingPayment(userId, booking, { transaction, reason } = {}) {
  const amount = Number(booking.amount);
  if (!Number.isFinite(amount) || amount < 1) return null;
  if (booking.paymentStatus !== 'paid' && !booking.paidAt) return null;

  return createLedgerEntry({
    userId,
    type: WALLET_TX_TYPES.REFUND,
    direction: 'credit',
    amount,
    title: 'Booking refund',
    body: `Refunded ₹${amount} for cancelled booking`,
    bookingId: booking.id,
    idempotencyKey: `booking_refund:${booking.id}:${userId}`,
    meta: { reason: reason || 'booking_cancelled', withdrawable: false },
    affectsBalance: true,
    transaction,
  });
}

async function listMyWithdrawals(userId, { limit = 20 } = {}) {
  const take = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const rows = await WithdrawalRequest.findAll({
    where: { userId },
    order: [['createdAt', 'DESC']],
    limit: take,
  });
  return { items: rows.map(formatWithdrawal) };
}

async function requestWithdrawal(userId, { amount, upiId, note } = {}) {
  const amt = Math.round(Number(amount));
  if (!Number.isFinite(amt) || amt < 99) {
    throw new AppError('Minimum withdrawal is ₹99', 400);
  }

  return sequelize.transaction(async (transaction) => {
    const user = await User.findByPk(userId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!user) throw new AppError('User not found', 404);

    const walletUpi = String(upiId || user.upiId || '').trim();
    if (!walletUpi) {
      throw new AppError('Add UPI ID in profile before withdrawing', 400);
    }

    const breakdown = await getWithdrawableBreakdown(userId, { transaction });
    const balance = Number(user.walletBalance || 0);
    const available = Math.min(breakdown.withdrawable, balance);

    if (amt > available) {
      throw new AppError(
        `Only meetup earnings can be withdrawn. Available: ₹${available}`,
        400
      );
    }

    const existingPending = await WithdrawalRequest.count({
      where: { userId, status: WITHDRAWAL_STATUS.PENDING },
      transaction,
    });
    if (existingPending > 0) {
      throw new AppError('You already have a pending withdrawal request', 400);
    }

    const row = await WithdrawalRequest.create(
      {
        userId,
        amount: amt,
        status: WITHDRAWAL_STATUS.PENDING,
        upiId: walletUpi.slice(0, 120),
        note: note ? String(note).trim().slice(0, 500) : null,
      },
      { transaction }
    );

    return formatWithdrawal(row);
  });
}

async function listWithdrawalsAdmin({ status, search, page = 1, limit = 20 } = {}) {
  const take = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const currentPage = Math.max(Number(page) || 1, 1);
  const where = {};
  if (status && ['pending', 'approved', 'rejected'].includes(String(status))) {
    where.status = status;
  }

  const userWhere = {};
  if (search && String(search).trim()) {
    const q = `%${String(search).trim()}%`;
    userWhere[Op.or] = [
      { firstName: { [Op.iLike]: q } },
      { lastName: { [Op.iLike]: q } },
      { mobileNumber: { [Op.iLike]: q } },
      { upiId: { [Op.iLike]: q } },
    ];
  }

  const { rows, count } = await WithdrawalRequest.findAndCountAll({
    where,
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'firstName', 'lastName', 'mobileNumber', 'upiId'],
        where: Object.keys(userWhere).length ? userWhere : undefined,
        required: true,
      },
    ],
    order: [
      ['status', 'ASC'],
      ['createdAt', 'DESC'],
    ],
    limit: take,
    offset: (currentPage - 1) * take,
  });

  return {
    items: rows.map(formatWithdrawal),
    pagination: {
      total: count,
      page: currentPage,
      limit: take,
      totalPages: Math.max(1, Math.ceil(count / take)),
    },
  };
}

async function reviewWithdrawal(adminId, withdrawalId, { action, adminNote } = {}) {
  const normalized = String(action || '').toLowerCase();
  const approve = ['approve', 'approved'].includes(normalized);
  const reject = ['reject', 'rejected'].includes(normalized);
  if (!approve && !reject) {
    throw new AppError('action must be approve or reject', 400);
  }

  return sequelize.transaction(async (transaction) => {
    const row = await WithdrawalRequest.findByPk(withdrawalId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!row) throw new AppError('Withdrawal request not found', 404);
    if (row.status !== WITHDRAWAL_STATUS.PENDING) {
      throw new AppError('Request already reviewed', 400);
    }

    if (reject) {
      row.status = WITHDRAWAL_STATUS.REJECTED;
      row.adminNote = adminNote ? String(adminNote).slice(0, 500) : null;
      row.reviewedByAdminId = adminId;
      row.reviewedAt = new Date();
      await row.save({ transaction });
      return formatWithdrawal(row);
    }

    const user = await User.findByPk(row.userId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!user) throw new AppError('User not found', 404);

    const breakdown = await getWithdrawableBreakdown(row.userId, { transaction });
    // pending includes this request — add it back for check against earned-withdrawn
    const availableEarnings =
      breakdown.earned - breakdown.withdrawn - (breakdown.pending - row.amount);
    const balance = Number(user.walletBalance || 0);
    const available = Math.min(Math.max(0, availableEarnings), balance);

    if (row.amount > available) {
      throw new AppError(
        `Cannot approve: withdrawable now ₹${available} (top-ups are not withdrawable)`,
        400
      );
    }

    const tx = await createLedgerEntry({
      userId: row.userId,
      type: WALLET_TX_TYPES.WITHDRAWAL,
      direction: 'debit',
      amount: row.amount,
      title: 'Withdrawal',
      body: `Withdrawal of ₹${row.amount} approved`,
      idempotencyKey: `withdrawal:${row.id}`,
      meta: { withdrawalId: row.id, upiId: row.upiId },
      affectsBalance: true,
      transaction,
    });

    // Payout inside the transaction: an API error rolls back the wallet debit.
    // Idempotency key = withdrawal id, so a retry never pays twice.
    if (razorpay.isPayoutConfigured() || razorpay.isTestMode()) {
      const payout = await razorpay.createUpiPayout({
        amountRupees: row.amount,
        upiId: row.upiId,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        mobile: user.mobileNumber,
        referenceId: row.id,
        idempotencyKey: `withdrawal_${row.id}`,
      });
      row.payoutId = payout.id;
      row.payoutStatus = payout.test ? `${payout.status} (test)` : payout.status;
      row.payoutUtr = payout.utr || null;
    } else {
      row.payoutStatus = 'manual';
    }

    row.status = WITHDRAWAL_STATUS.APPROVED;
    row.adminNote = adminNote ? String(adminNote).slice(0, 500) : null;
    row.reviewedByAdminId = adminId;
    row.reviewedAt = new Date();
    row.walletTransactionId = tx.id;
    await row.save({ transaction });

    return formatWithdrawal(row);
  });
}

const PAYOUT_FAILED_STATES = ['failed', 'reversed', 'rejected', 'cancelled'];

/** RazorpayX payout webhook → update withdrawal; failed payouts are credited back. */
async function applyPayoutUpdate(payout) {
  return sequelize.transaction(async (transaction) => {
    const where = payout.id ? { payoutId: payout.id } : { id: payout.reference_id };
    let row = await WithdrawalRequest.findOne({
      where,
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!row && payout.reference_id) {
      row = await WithdrawalRequest.findOne({
        where: { id: payout.reference_id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
    }
    if (!row) return null;

    row.payoutId = row.payoutId || payout.id;
    row.payoutStatus = payout.status;
    if (payout.utr) row.payoutUtr = payout.utr;

    if (PAYOUT_FAILED_STATES.includes(payout.status) && row.status === WITHDRAWAL_STATUS.APPROVED) {
      const reason =
        payout.status_details?.description || payout.failure_reason || `Payout ${payout.status}`;
      await createLedgerEntry({
        userId: row.userId,
        type: WALLET_TX_TYPES.WITHDRAWAL,
        direction: 'credit',
        amount: row.amount,
        title: 'Withdrawal reversed',
        body: `₹${row.amount} returned to wallet — payout ${payout.status}`,
        idempotencyKey: `withdrawal_reversal:${row.id}`,
        meta: { withdrawalId: row.id, payoutId: payout.id, reason },
        affectsBalance: true,
        transaction,
      });
      row.status = WITHDRAWAL_STATUS.REJECTED;
      row.payoutFailureReason = String(reason).slice(0, 500);
      row.adminNote = `Payout failed: ${reason}`.slice(0, 500);
    }

    await row.save({ transaction });
    return formatWithdrawal(row);
  });
}

module.exports = {
  WALLET_TX_TYPES,
  WITHDRAWAL_STATUS,
  getWallet,
  listTransactions,
  topUp,
  assertTopUpAmount,
  creditTopUp,
  createLedgerEntry,
  recordBookingPayment,
  recordBookingEarning,
  refundBookingPayment,
  getWithdrawableBreakdown,
  requestWithdrawal,
  listMyWithdrawals,
  listWithdrawalsAdmin,
  reviewWithdrawal,
  applyPayoutUpdate,
};
