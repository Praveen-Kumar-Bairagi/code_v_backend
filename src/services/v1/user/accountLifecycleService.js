'use strict';

const { Op } = require('sequelize');
const {
  Conversation,
  E2eeDeviceKey,
  ExpoPushToken,
  Like,
  Message,
  Notification,
  PlanInterest,
  ProfilePass,
  User,
  UserBlock,
  UserPlan,
  UserReport,
  sequelize,
} = require('../../../models');
const AppError = require('../../../utils/AppError');
const otpService = require('./otpService');
const deviceSessionService = require('./deviceSessionService');
const legalRetentionService = require('../../legalRetentionService');
const storageService = require('../../storageService');
const normalizeMobile = require('../../../utils/normalizeMobile');

const PURPOSE_DEACTIVATE = 'account_deactivate';
const PURPOSE_DELETE = 'account_delete';

/** Typed confirmation for accounts without a verified mobile (e.g. Google sign-ups). */
const CONFIRM_WORD = { deactivate: 'DEACTIVATE', delete: 'DELETE' };

async function loadUser(userId) {
  const user = await User.findByPk(userId);
  if (!user) throw new AppError('Account not found', 404);
  if (String(user.mobileNumber || '').startsWith('deleted:')) {
    throw new AppError('This account has been deleted', 400);
  }
  if (user.accountStatus === 'blocked') {
    throw new AppError('This account has been blocked. Contact support.', 403);
  }
  if (user.accountStatus === 'suspended') {
    throw new AppError('This account has been suspended. Contact support.', 403);
  }
  return user;
}

function requireMobile(user) {
  if (!user.mobileNumber) {
    throw new AppError('No mobile number on this account — confirm by typing the word instead.', 400);
  }
  return normalizeMobile(user.mobileNumber);
}

/** OTP when the account has a mobile; otherwise the typed confirmation word. */
function verifyConfirmation(user, { otp, confirm }, action) {
  if (user.mobileNumber) {
    otpService.verifyOtp(
      normalizeMobile(user.mobileNumber),
      otp,
      action === 'delete' ? PURPOSE_DELETE : PURPOSE_DEACTIVATE
    );
    return;
  }
  if (String(confirm || '').trim().toUpperCase() !== CONFIRM_WORD[action]) {
    throw new AppError(`Type ${CONFIRM_WORD[action]} to confirm`, 400);
  }
}

async function requestDeactivateOtp(userId) {
  const user = await loadUser(userId);
  if (!user.isActive) {
    throw new AppError('Account is already deactivated', 400);
  }
  return otpService.requestOtp(requireMobile(user), PURPOSE_DEACTIVATE);
}

async function requestDeleteOtp(userId) {
  const user = await loadUser(userId);
  return otpService.requestOtp(requireMobile(user), PURPOSE_DELETE);
}

async function deactivateAccount(userId, body = {}) {
  const user = await loadUser(userId);
  if (!user.isActive) {
    throw new AppError('Account is already deactivated', 400);
  }
  verifyConfirmation(user, body, 'deactivate');

  user.isActive = false;
  user.accountStatus = 'inactive';
  await user.save();
  await deviceSessionService.revokeAllSessions(userId);

  return {
    message: 'Account deactivated. Log in again to reactivate.',
  };
}

/**
 * Removes the person's profile, activity and chats.
 * Kept for legal / safety reasons: payment, subscription, coin and wallet records,
 * reports (with their evidence snapshot) and chat moderation logs. Registration details and
 * chats also go to the 180-day legal retention store first.
 */
async function purgeUserData(user, transaction) {
  const userId = user.id;

  const conversations = await Conversation.findAll({
    where: { [Op.or]: [{ participantOneId: userId }, { participantTwoId: userId }] },
    attributes: ['id'],
    transaction,
  });
  const conversationIds = conversations.map((c) => c.id);
  await legalRetentionService.archiveDeletedAccount(user, { transaction });
  if (conversationIds.length) {
    await legalRetentionService.archiveConversations(conversationIds, {
      reason: 'account_deleted',
      actorId: userId,
      transaction,
    });
    await Message.destroy({ where: { conversationId: { [Op.in]: conversationIds } }, transaction });
    await Conversation.destroy({ where: { id: { [Op.in]: conversationIds } }, transaction });
  }

  const planIds = (
    await UserPlan.findAll({ where: { userId }, attributes: ['id'], transaction })
  ).map((p) => p.id);
  await PlanInterest.destroy({
    where: {
      [Op.or]: [{ userId }, ...(planIds.length ? [{ planId: { [Op.in]: planIds } }] : [])],
    },
    transaction,
  });
  await UserPlan.update({ status: 'cancelled' }, { where: { userId }, transaction });

  const pair = { [Op.or]: [{ fromUserId: userId }, { toUserId: userId }] };
  await Like.destroy({ where: pair, transaction });
  await ProfilePass.destroy({ where: pair, transaction });
  await UserBlock.destroy({
    where: { [Op.or]: [{ blockerId: userId }, { blockedId: userId }] },
    transaction,
  });
  await Notification.destroy({ where: { recipientId: userId }, transaction });
  await ExpoPushToken.destroy({ where: { userId }, transaction });
  await E2eeDeviceKey.destroy({ where: { userId }, transaction });

  await user.update(
    {
      isActive: false,
      accountStatus: 'inactive',
      firstName: 'Deleted',
      lastName: 'User',
      dateOfBirth: '1970-01-01',
      email: `deleted+${userId}@deleted.local`,
      mobileNumber: `deleted:${userId}`,
      googleUid: null,
      pincode: null,
      upiId: null,
      aboutMe: null,
      pendingBio: null,
      bioStatus: 'none',
      education: null,
      profession: null,
      religion: null,
      drinking: null,
      smoking: null,
      eating: null,
      relationshipStatus: null,
      lookingFor: null,
      interests: [],
      photos: [],
      selectedServiceIds: [],
      availability: {},
      settings: {},
      hideAge: true,
      photoVerified: false,
      facebookVerified: false,
      kycVerified: false,
      kycFileName: null,
      isCreator: false,
      creatorHandle: null,
      creatorExpiresAt: null,
      latitude: null,
      longitude: null,
      locationUpdatedAt: null,
      lastActiveAt: null,
    },
    { transaction }
  );
}

async function deleteAccount(userId, body = {}) {
  const user = await loadUser(userId);
  verifyConfirmation(user, body, 'delete');

  const photos = (Array.isArray(user.photos) ? user.photos : []).filter(Boolean);
  // Photos of someone under review are kept until the report is closed (the report keeps their paths).
  const underReview = await UserReport.count({
    where: { reportedUserId: user.id, status: 'pending' },
  });

  await sequelize.transaction((transaction) => purgeUserData(user, transaction));
  await deviceSessionService.revokeAllSessions(userId);

  if (!underReview) {
    for (const photo of photos) {
      try {
        await storageService.deleteProfilePicture(String(photo));
      } catch (err) {
        console.warn('[account-delete] could not remove photo', err?.message || err);
      }
    }
  }

  return {
    message: 'Account deleted',
  };
}

module.exports = {
  requestDeactivateOtp,
  requestDeleteOtp,
  deactivateAccount,
  deleteAccount,
};
