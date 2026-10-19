const { Op } = require('sequelize');
const {
  UserBlock,
  User,
  Like,
  ProfilePass,
  Conversation,
  Message,
  sequelize,
} = require('../../../models');
const AppError = require('../../../utils/AppError');
const { sortParticipantIds } = require('../../../utils/conversationPair');
const storageService = require('../../storageService');
const { areMatched } = require('./likeService');
const legalRetentionService = require('../../legalRetentionService');

const userPreviewAttributes = ['id', 'firstName', 'lastName', 'photos'];

function firstPhotoUrl(photos) {
  if (!Array.isArray(photos)) return null;
  const first = photos.find(Boolean);
  if (!first) return null;
  return storageService.getPublicUrl(String(first));
}

function formatUserPreview(user) {
  if (!user) return null;
  const json = user.toJSON ? user.toJSON() : user;
  return {
    id: json.id,
    firstName: json.firstName,
    lastName: json.lastName,
    photoUrl: firstPhotoUrl(json.photos),
  };
}

/** `userA` is the member who blocked or unmatched; a hidden copy is kept for 180 days. */
async function removeConversationBetween(userA, userB, reason = 'blocked') {
  const pair = sortParticipantIds(userA, userB);
  if (!pair) return null;
  const [participantOneId, participantTwoId] = pair;
  const conversation = await Conversation.findOne({
    where: { participantOneId, participantTwoId },
  });
  if (!conversation) return null;
  await sequelize.transaction(async (transaction) => {
    await legalRetentionService.archiveConversations([conversation.id], { reason, actorId: userA, transaction });
    await Message.destroy({ where: { conversationId: conversation.id }, transaction });
    await conversation.destroy({ transaction });
  });
  return conversation.id;
}

async function clearLikeRelationship(userA, userB) {
  await Like.destroy({
    where: {
      [Op.or]: [
        { fromUserId: userA, toUserId: userB },
        { fromUserId: userB, toUserId: userA },
      ],
    },
  });
}

async function isBlockedEitherWay(userA, userB) {
  if (!userA || !userB || String(userA) === String(userB)) return false;
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

async function getBlockedRelatedUserIds(viewerId) {
  const rows = await UserBlock.findAll({
    where: {
      [Op.or]: [{ blockerId: viewerId }, { blockedId: viewerId }],
    },
    attributes: ['blockerId', 'blockedId'],
  });
  const ids = new Set();
  for (const row of rows) {
    const json = row.toJSON ? row.toJSON() : row;
    if (String(json.blockerId) === String(viewerId)) {
      ids.add(String(json.blockedId));
    } else {
      ids.add(String(json.blockerId));
    }
  }
  return [...ids];
}

async function blockUser(blockerId, blockedId) {
  if (!blockedId) throw new AppError('User id is required', 400);
  if (String(blockerId) === String(blockedId)) {
    throw new AppError('Cannot block yourself', 400);
  }

  const target = await User.findOne({
    where: { id: blockedId, isActive: true },
    attributes: ['id'],
  });
  if (!target) throw new AppError('User not found', 404);

  await sequelize.transaction(async (transaction) => {
    await UserBlock.findOrCreate({
      where: { blockerId, blockedId },
      defaults: { blockerId, blockedId },
      transaction,
    });
    await clearLikeRelationship(blockerId, blockedId);
    await ProfilePass.findOrCreate({
      where: { fromUserId: blockerId, toUserId: blockedId },
      defaults: { fromUserId: blockerId, toUserId: blockedId },
      transaction,
    });
  });

  const conversationId = await removeConversationBetween(blockerId, blockedId);

  return {
    blocked: true,
    blockedUserId: String(blockedId),
    conversationRemoved: !!conversationId,
  };
}

async function unblockUser(blockerId, blockedId) {
  const row = await UserBlock.findOne({
    where: { blockerId, blockedId },
  });
  if (!row) throw new AppError('User is not blocked', 404);
  await row.destroy();
  return { unblocked: true, userId: String(blockedId) };
}

async function listBlockedUsers(blockerId) {
  const rows = await UserBlock.findAll({
    where: { blockerId },
    include: [{ model: User, as: 'blocked', attributes: userPreviewAttributes }],
    order: [['createdAt', 'DESC']],
  });

  return rows.map((row) => {
    const json = row.toJSON ? row.toJSON() : row;
    return {
      id: json.id,
      blockedUserId: json.blockedId,
      createdAt: json.createdAt,
      person: formatUserPreview(json.blocked),
    };
  });
}

async function unmatchUser(userId, otherUserId) {
  if (!otherUserId) throw new AppError('User id is required', 400);
  if (String(userId) === String(otherUserId)) {
    throw new AppError('Invalid user', 400);
  }

  const matched = await areMatched(userId, otherUserId);
  if (!matched) {
    throw new AppError('You are not matched with this person', 400);
  }

  await clearLikeRelationship(userId, otherUserId);
  const conversationId = await removeConversationBetween(userId, otherUserId, 'unmatched');

  return {
    unmatched: true,
    userId: String(otherUserId),
    conversationRemoved: !!conversationId,
  };
}

module.exports = {
  blockUser,
  unblockUser,
  listBlockedUsers,
  unmatchUser,
  isBlockedEitherWay,
  getBlockedRelatedUserIds,
  removeConversationBetween,
};
