'use strict';

const { Op } = require('sequelize');
const { CreatorRequest, User, sequelize } = require('../../../models');
const AppError = require('../../../utils/AppError');
const { createAndEmitNotification } = require('./notificationCreateService');
const creatorProfile = require('./creatorProfileService');

const USER_ATTRS = [
  'id',
  'firstName',
  'lastName',
  'mobileNumber',
  'email',
  'isCreator',
  'creatorHandle',
  'creatorExpiresAt',
];

const STATUS = { PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function formatRequest(row) {
  if (!row) return null;
  const json = typeof row.toJSON === 'function' ? row.toJSON() : row;
  return {
    id: json.id,
    userId: json.userId,
    email: json.email,
    phone: json.phone,
    note: json.note || null,
    status: json.status,
    adminNote: json.adminNote || null,
    durationMonths: json.durationMonths || null,
    reviewedAt: json.reviewedAt || null,
    createdAt: json.createdAt,
    updatedAt: json.updatedAt,
    user: json.user
      ? {
          id: json.user.id,
          firstName: json.user.firstName,
          lastName: json.user.lastName,
          mobileNumber: json.user.mobileNumber,
          email: json.user.email,
          ...creatorProfile.creatorInfo(json.user),
        }
      : undefined,
  };
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const local = digits.length > 10 && digits.startsWith('91') ? digits.slice(-10) : digits;
  if (!/^[6-9]\d{9}$/.test(local)) {
    throw new AppError('Enter a valid 10-digit mobile number', 400);
  }
  return local;
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 160) {
    throw new AppError('Enter a valid email address', 400);
  }
  return email;
}

async function getMyStatus(userId) {
  const user = await User.findByPk(userId, { attributes: USER_ATTRS });
  if (!user) throw new AppError('User not found', 404);
  const latest = await CreatorRequest.findOne({
    where: { userId },
    order: [['createdAt', 'DESC']],
  });
  const info = creatorProfile.creatorInfo(user);
  const wasCreator = Boolean(!info.isCreator && user.creatorExpiresAt);
  return {
    ...info,
    expired: wasCreator,
    canRequest: !info.isCreator && latest?.status !== STATUS.PENDING,
    request: formatRequest(latest),
    defaults: { email: user.email || '', phone: user.mobileNumber || '' },
  };
}

async function submitRequest(userId, { email, phone, note } = {}) {
  const cleanEmail = normalizeEmail(email);
  const cleanPhone = normalizePhone(phone);

  const row = await sequelize.transaction(async (transaction) => {
    const user = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user) throw new AppError('User not found', 404);
    if (creatorProfile.isActiveCreator(user)) throw new AppError('You are already a creator', 400);

    const pending = await CreatorRequest.findOne({
      where: { userId, status: STATUS.PENDING },
      transaction,
    });
    if (pending) {
      throw new AppError('Your creator request is already pending review', 409, 'CREATOR_REQUEST_PENDING');
    }

    return CreatorRequest.create(
      {
        userId,
        email: cleanEmail,
        phone: cleanPhone,
        note: note ? String(note).trim().slice(0, 500) || null : null,
        status: STATUS.PENDING,
      },
      { transaction }
    );
  });
  return formatRequest(row);
}

async function listRequestsAdmin({ status, search, page = 1, limit = 20 } = {}) {
  const pageNum = Math.max(1, Number(page) || 1);
  const perPage = Math.min(100, Math.max(1, Number(limit) || 20));
  const where = {};
  if (status && Object.values(STATUS).includes(status)) where.status = status;

  const q = String(search || '').trim();
  if (q) {
    const like = { [Op.iLike]: `%${q}%` };
    where[Op.or] = [
      { email: like },
      { phone: like },
      { '$user.firstName$': like },
      { '$user.lastName$': like },
      { '$user.mobileNumber$': like },
      { '$user.creatorHandle$': like },
    ];
  }

  const { rows, count } = await CreatorRequest.findAndCountAll({
    where,
    include: [{ model: User, as: 'user', attributes: USER_ATTRS }],
    order: [['createdAt', 'DESC']],
    limit: perPage,
    offset: (pageNum - 1) * perPage,
    subQuery: false,
  });

  return {
    items: rows.map(formatRequest),
    pagination: {
      page: pageNum,
      limit: perPage,
      total: count,
      totalPages: Math.max(1, Math.ceil(count / perPage)),
    },
  };
}

async function reviewRequestAdmin(adminId, id, { action, adminNote, durationMonths } = {}) {
  if (!['approve', 'reject'].includes(action)) {
    throw new AppError('action must be approve or reject', 400);
  }
  const months = action === 'approve' ? creatorProfile.assertDurationMonths(durationMonths) : null;
  let grantedUser = null;
  const row = await sequelize.transaction(async (transaction) => {
    const req = await CreatorRequest.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!req) throw new AppError('Creator request not found', 404);
    if (req.status !== STATUS.PENDING) {
      throw new AppError(`Request already ${req.status}`, 400);
    }
    req.status = action === 'approve' ? STATUS.APPROVED : STATUS.REJECTED;
    req.adminNote = adminNote ? String(adminNote).trim().slice(0, 500) || null : null;
    req.reviewedByAdminId = adminId || null;
    req.reviewedAt = new Date();
    req.durationMonths = months;
    await req.save({ transaction });

    if (action === 'approve') {
      const user = await User.findByPk(req.userId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!user) throw new AppError('User not found', 404);
      grantedUser = await creatorProfile.grantCreator(user, months, { transaction });
    }
    return req;
  });

  const approved = row.status === STATUS.APPROVED;
  const validTill = grantedUser?.creatorExpiresAt
    ? new Date(grantedUser.creatorExpiresAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;
  await createAndEmitNotification({
    recipientId: row.userId,
    type: approved ? 'creator_request_approved' : 'creator_request_rejected',
    title: approved ? 'You are now a creator 🎉' : 'Creator request not approved',
    body: approved
      ? `Your creator ID is @${grantedUser?.creatorHandle}. Valid till ${validTill}.`
      : row.adminNote
        ? `Reason: ${row.adminNote}. You can send a new request.`
        : 'Your creator request was not approved. You can send a new request.',
    data: { creatorRequestId: row.id, status: row.status },
  }).catch((err) => console.error('creator request notification failed', err));

  const fresh = await CreatorRequest.findByPk(row.id, {
    include: [{ model: User, as: 'user', attributes: USER_ATTRS }],
  });
  return formatRequest(fresh);
}

async function countPending() {
  return CreatorRequest.count({ where: { status: STATUS.PENDING } });
}

module.exports = {
  STATUS,
  getMyStatus,
  submitRequest,
  listRequestsAdmin,
  reviewRequestAdmin,
  countPending,
};
