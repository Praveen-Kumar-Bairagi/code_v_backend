const { Op } = require('sequelize');
const { Like, ProfilePass, UserBlock, User, sequelize } = require('../../../models');
const AppError = require('../../../utils/AppError');
const storageService = require('../../storageService');
const {
  createAndEmitNotification,
  emitExistingNotification,
} = require('./notificationCreateService');
const chatService = require('./chatService');

const userPreviewAttributes = [
  'id',
  'firstName',
  'lastName',
  'photos',
  'gender',
  'dateOfBirth',
  'hideAge',
  'cityId',
  'photoVerified',
  'kycVerified',
];

function firstPhotoUrl(photos) {
  if (!Array.isArray(photos)) return null;
  const first = photos.find(Boolean);
  if (!first) return null;
  return storageService.getPublicUrl(String(first));
}

function calcAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age;
}

function formatUserPreview(user) {
  if (!user) return null;
  const json = user.toJSON ? user.toJSON() : user;
  const hideAge = !!json.hideAge;
  const age = hideAge ? null : calcAge(json.dateOfBirth);
  return {
    id: json.id,
    firstName: json.firstName,
    lastName: json.lastName,
    fullName: [json.firstName, json.lastName].filter(Boolean).join(' ').trim(),
    photoUrl: firstPhotoUrl(json.photos),
    gender: json.gender || null,
    age,
    photoVerified: !!json.photoVerified,
    kycVerified: !!json.kycVerified,
    // Every account signs up through mobile OTP.
    mobileVerified: true,
  };
}

function formatLike(row, { asReceived = true } = {}) {
  const json = row.toJSON ? row.toJSON() : row;
  const other = asReceived ? json.fromUser : json.toUser;
  return {
    id: json.id,
    status: json.status,
    fromUserId: json.fromUserId,
    toUserId: json.toUserId,
    createdAt: json.createdAt,
    updatedAt: json.updatedAt,
    person: formatUserPreview(other),
  };
}

async function areMatched(userA, userB) {
  if (!userA || !userB || String(userA) === String(userB)) return false;
  const row = await Like.findOne({
    where: {
      status: 'matched',
      [Op.or]: [
        { fromUserId: userA, toUserId: userB },
        { fromUserId: userB, toUserId: userA },
      ],
    },
    attributes: ['id'],
  });
  return !!row;
}

async function getStatusBetween(viewerId, otherUserId) {
  if (String(viewerId) === String(otherUserId)) {
    return { status: 'self', likeId: null, matched: false };
  }

  const [sent, received] = await Promise.all([
    Like.findOne({
      where: { fromUserId: viewerId, toUserId: otherUserId },
    }),
    Like.findOne({
      where: { fromUserId: otherUserId, toUserId: viewerId },
    }),
  ]);

  if (sent?.status === 'matched' || received?.status === 'matched') {
    return {
      status: 'matched',
      likeId: sent?.id || received?.id || null,
      matched: true,
    };
  }
  if (sent?.status === 'rejected' || received?.status === 'rejected') {
    return {
      status: 'rejected',
      likeId: sent?.id || received?.id || null,
      matched: false,
    };
  }
  if (sent?.status === 'pending') {
    return { status: 'pending_sent', likeId: sent.id, matched: false };
  }
  if (received?.status === 'pending') {
    return { status: 'pending_received', likeId: received.id, matched: false };
  }
  return { status: 'none', likeId: null, matched: false };
}

async function notifyMatch(userAId, userBId, conversationId, transaction) {
  const [userA, userB] = await Promise.all([
    User.findByPk(userAId, { attributes: ['id', 'firstName', 'lastName'] }),
    User.findByPk(userBId, { attributes: ['id', 'firstName', 'lastName'] }),
  ]);
  const nameA = userA?.firstName || 'Someone';
  const nameB = userB?.firstName || 'Someone';

  const n1 = await createAndEmitNotification({
    recipientId: userAId,
    type: 'match',
    title: 'It\'s a match!',
    body: `You and ${nameB} are interested in each other. Start chatting.`,
    data: {
      otherUserId: userBId,
      conversationId: conversationId || null,
    },
    transaction,
  });
  const n2 = await createAndEmitNotification({
    recipientId: userBId,
    type: 'match',
    title: 'It\'s a match!',
    body: `You and ${nameA} are interested in each other. Start chatting.`,
    data: {
      otherUserId: userAId,
      conversationId: conversationId || null,
    },
    transaction,
  });
  return [n1, n2];
}

async function sendLike(fromUserId, toUserId) {
  if (!toUserId) throw new AppError('User id is required', 400);
  if (String(fromUserId) === String(toUserId)) {
    throw new AppError('Cannot like yourself', 400);
  }

  const target = await User.findOne({
    where: { id: toUserId, isActive: true },
    attributes: ['id', 'firstName', 'lastName', 'isActive'],
  });
  if (!target || (await isBlockedBetween(fromUserId, toUserId))) {
    throw new AppError('User not found', 404);
  }

  // Liking clears a prior skip so they leave the skipped list
  await ProfilePass.destroy({ where: { fromUserId, toUserId } });

  const existing = await Like.findOne({
    where: { fromUserId, toUserId },
  });
  if (existing) {
    if (existing.status === 'rejected') {
      throw new AppError('This like was rejected', 400);
    }
    if (existing.status === 'matched') {
      return {
        like: formatLike(
          await Like.findByPk(existing.id, {
            include: [{ model: User, as: 'toUser', attributes: userPreviewAttributes }],
          }),
          { asReceived: false }
        ),
        matched: true,
        conversationId: null,
      };
    }
    // already pending
    return {
      like: {
        id: existing.id,
        status: existing.status,
        fromUserId: existing.fromUserId,
        toUserId: existing.toUserId,
        createdAt: existing.createdAt,
        person: formatUserPreview(target),
      },
      matched: false,
      conversationId: null,
    };
  }

  const reverse = await Like.findOne({
    where: { fromUserId: toUserId, toUserId: fromUserId },
  });

  const result = await sequelize.transaction(async (transaction) => {
    if (reverse && reverse.status === 'pending') {
      const like = await Like.create(
        {
          fromUserId,
          toUserId,
          status: 'matched',
        },
        { transaction }
      );
      await reverse.update({ status: 'matched' }, { transaction });
      const conversation = await chatService.ensureConversationBetween(
        fromUserId,
        toUserId
      );
      const notifications = await notifyMatch(
        fromUserId,
        toUserId,
        conversation?.id || null,
        transaction
      );
      return { like, matched: true, conversationId: conversation?.id || null, notifications };
    }

    if (reverse && reverse.status === 'rejected') {
      throw new AppError('Cannot like — previous request was rejected', 400);
    }

    const like = await Like.create(
      {
        fromUserId,
        toUserId,
        status: 'pending',
      },
      { transaction }
    );

    const fromUser = await User.findByPk(fromUserId, {
      attributes: ['id', 'firstName', 'lastName'],
      transaction,
    });
    const fromName = fromUser?.firstName || 'Someone';

    const notification = await createAndEmitNotification({
      recipientId: toUserId,
      type: 'like',
      title: `${fromName} is interested in you`,
      body: 'Accept to unlock chat, or reject.',
      data: {
        likeId: like.id,
        fromUserId,
      },
      transaction,
    });

    return { like, matched: false, conversationId: null, notifications: [notification] };
  });

  if (Array.isArray(result.notifications)) {
    for (const n of result.notifications) {
      if (n && n.recipientId) await emitExistingNotification(n);
    }
  }

  const loaded = await Like.findByPk(result.like.id, {
    include: [{ model: User, as: 'toUser', attributes: userPreviewAttributes }],
  });

  return {
    like: formatLike(loaded, { asReceived: false }),
    matched: result.matched,
    conversationId: result.conversationId,
  };
}

async function respondToLike(userId, likeId, action) {
  const act = String(action || '').toLowerCase();
  if (act !== 'like_back' && act !== 'reject') {
    throw new AppError('action must be like_back or reject', 400);
  }

  const like = await Like.findByPk(likeId);
  if (!like) throw new AppError('Like not found', 404);
  if (String(like.toUserId) !== String(userId)) {
    throw new AppError('Not allowed', 403);
  }
  if (like.status !== 'pending') {
    throw new AppError('This like is no longer pending', 400);
  }

  if (act === 'reject') {
    await like.update({ status: 'rejected' });
    return { status: 'rejected', conversationId: null, matched: false };
  }

  const result = await sequelize.transaction(async (transaction) => {
    await like.update({ status: 'matched' }, { transaction });

    let reverse = await Like.findOne({
      where: { fromUserId: userId, toUserId: like.fromUserId },
      transaction,
    });
    if (reverse) {
      await reverse.update({ status: 'matched' }, { transaction });
    } else {
      reverse = await Like.create(
        {
          fromUserId: userId,
          toUserId: like.fromUserId,
          status: 'matched',
        },
        { transaction }
      );
    }

    const conversation = await chatService.ensureConversationBetween(
      userId,
      like.fromUserId
    );
    const notifications = await notifyMatch(
      userId,
      like.fromUserId,
      conversation?.id || null,
      transaction
    );

    return {
      status: 'matched',
      matched: true,
      conversationId: conversation?.id || null,
      notifications,
    };
  });

  if (Array.isArray(result.notifications)) {
    for (const n of result.notifications) {
      if (n && n.recipientId) await emitExistingNotification(n);
    }
  }

  return {
    status: result.status,
    matched: true,
    conversationId: result.conversationId,
  };
}

async function listReceived(userId, { status = 'pending' } = {}) {
  const where = { toUserId: userId };
  if (status && status !== 'all') {
    where.status = status;
  }

  const rows = await Like.findAll({
    where,
    include: [{ model: User, as: 'fromUser', attributes: userPreviewAttributes }],
    order: [['createdAt', 'DESC']],
  });

  return rows.map((r) => formatLike(r, { asReceived: true }));
}

async function listSent(userId) {
  const rows = await Like.findAll({
    where: { fromUserId: userId },
    include: [{ model: User, as: 'toUser', attributes: userPreviewAttributes }],
    order: [['createdAt', 'DESC']],
  });
  return rows.map((r) => formatLike(r, { asReceived: false }));
}

async function isBlockedBetween(userA, userB) {
  const row = await UserBlock.findOne({
    where: {
      [Op.or]: [
        { blockerId: userA, blockedId: userB },
        { blockerId: userB, blockedId: userA },
      ],
    },
    attributes: ['id'],
  });
  return !!row;
}

/** Users blocked by the viewer or who blocked the viewer. */
async function getBlockedUserIds(viewerId) {
  const blocks = await UserBlock.findAll({
    where: {
      [Op.or]: [{ blockerId: viewerId }, { blockedId: viewerId }],
    },
    attributes: ['blockerId', 'blockedId'],
  });
  return blocks.map((row) => {
    const json = row.toJSON ? row.toJSON() : row;
    return String(json.blockerId) === String(viewerId)
      ? String(json.blockedId)
      : String(json.blockerId);
  });
}

/** Liked, skipped or blocked — hidden from the discover feed. */
async function getExcludedUserIds(viewerId) {
  const [likes, passes, blockedIds] = await Promise.all([
    Like.findAll({
      where: { fromUserId: viewerId },
      attributes: ['toUserId'],
    }),
    ProfilePass.findAll({
      where: { fromUserId: viewerId },
      attributes: ['toUserId'],
    }),
    getBlockedUserIds(viewerId),
  ]);
  return [
    ...new Set([
      ...likes.map((r) => String(r.toUserId)),
      ...passes.map((r) => String(r.toUserId)),
      ...blockedIds,
    ]),
  ];
}

async function skipPerson(fromUserId, toUserId) {
  if (!toUserId) throw new AppError('User id is required', 400);
  if (String(fromUserId) === String(toUserId)) {
    throw new AppError('Cannot skip yourself', 400);
  }

  const target = await User.findOne({
    where: { id: toUserId, isActive: true },
    attributes: ['id'],
  });
  if (!target) throw new AppError('User not found', 404);

  // Already liked — treat as skip of discover only if no like; don't destroy matches
  const existingLike = await Like.findOne({
    where: { fromUserId, toUserId },
  });
  if (existingLike && existingLike.status === 'matched') {
    throw new AppError('You are already matched with this person', 400);
  }
  if (existingLike && existingLike.status === 'pending') {
    // User chose skip after liking elsewhere — remove pending like
    await existingLike.destroy();
  }

  const [pass] = await ProfilePass.findOrCreate({
    where: { fromUserId, toUserId },
    defaults: { fromUserId, toUserId },
  });

  return {
    id: pass.id,
    toUserId: String(toUserId),
    skipped: true,
  };
}

async function listSkips(userId) {
  const rows = await ProfilePass.findAll({
    where: { fromUserId: userId },
    include: [{ model: User, as: 'toUser', attributes: userPreviewAttributes }],
    order: [['createdAt', 'DESC']],
  });

  return rows.map((row) => {
    const json = row.toJSON ? row.toJSON() : row;
    return {
      id: json.id,
      status: 'skipped',
      fromUserId: json.fromUserId,
      toUserId: json.toUserId,
      createdAt: json.createdAt,
      updatedAt: json.updatedAt,
      person: formatUserPreview(json.toUser),
    };
  });
}

async function undoSkip(userId, passId) {
  const pass = await ProfilePass.findOne({
    where: { id: passId, fromUserId: userId },
  });
  if (!pass) throw new AppError('Skip not found', 404);
  await pass.destroy();
  return { undone: true, toUserId: pass.toUserId };
}

module.exports = {
  sendLike,
  respondToLike,
  listReceived,
  listSent,
  listSkips,
  skipPerson,
  undoSkip,
  getExcludedUserIds,
  getBlockedUserIds,
  isBlockedBetween,
  getStatusBetween,
  areMatched,
};
