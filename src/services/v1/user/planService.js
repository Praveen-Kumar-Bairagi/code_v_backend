const { Op } = require('sequelize');
const { City, CityArea, PlanInterest, PlanType, User, UserPlan, sequelize } = require('../../../models');
const AppError = require('../../../utils/AppError');
const coinService = require('./coinService');
const storageService = require('../../storageService');
const { emitToUser } = require('../../../socket/io');
const { createAndEmitNotification } = require('./notificationCreateService');
const { getBlockedRelatedUserIds, isBlockedEitherWay } = require('./blockService');
const { ensureConversationBetween } = require('./chatService');

/** People within this distance of the plan's area are notified / see it. */
const PLAN_RADIUS_KM = 50;
/** A plan stays live this long after it is posted; then the owner can post a new one. */
const PLAN_LIFETIME_HOURS = 24;
const PLAN_LIFETIME_MS = PLAN_LIFETIME_HOURS * 60 * 60 * 1000;
const MAX_NOTIFY = 2000;

const GENDERS = ['all', 'male', 'female'];
const INTEREST = { INTERESTED: 'interested', NOT_INTERESTED: 'not_interested' };

const ownerAttributes = [
  'id',
  'firstName',
  'lastName',
  'gender',
  'dateOfBirth',
  'hideAge',
  'photos',
  'photoVerified',
  'kycVerified',
];

function haversineKm(lat1, lon1, lat2, lon2) {
  const nums = [lat1, lon1, lat2, lon2].map(Number);
  if (!nums.every((n) => Number.isFinite(n)) || [lat1, lon1, lat2, lon2].some((v) => v == null)) {
    return null;
  }
  const [aLat, aLon, bLat, bLon] = nums;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const a =
    Math.sin(toRad(bLat - aLat) / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(toRad(bLon - aLon) / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
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

function formatPerson(user) {
  if (!user) return null;
  const json = user.toJSON ? user.toJSON() : user;
  const first = Array.isArray(json.photos) ? json.photos.find(Boolean) : null;
  return {
    id: json.id,
    firstName: json.firstName,
    lastName: json.lastName,
    gender: json.gender,
    age: json.hideAge ? null : calcAge(json.dateOfBirth),
    photoUrl: first ? storageService.getPublicUrl(String(first)) : null,
    photoVerified: !!json.photoVerified,
    kycVerified: !!json.kycVerified,
    // Every account signs up through mobile OTP.
    mobileVerified: true,
  };
}

/** Plans are posted "now", so scheduledAt is the posting time. */
const visibleSince = () => new Date(Date.now() - PLAN_LIFETIME_MS);

/** "Posted just now" / "Posted 25 min ago" / "Posted 3h ago". */
function planTimeLabel(postedAt) {
  const mins = Math.max(0, Math.floor((Date.now() - postedAt.getTime()) / 60000));
  if (mins < 2) return 'Posted just now';
  if (mins < 60) return `Posted ${mins} min ago`;
  return `Posted ${Math.floor(mins / 60)}h ago`;
}

function formatPlan(plan, extra = {}) {
  const json = plan.toJSON ? plan.toJSON() : plan;
  const postedAt = new Date(json.scheduledAt);
  return {
    id: json.id,
    planTypeId: json.planTypeId,
    planName: json.planName,
    planEmoji: json.planEmoji || null,
    cityId: json.cityId,
    cityName: json.city?.name || null,
    cityAreaId: json.cityAreaId,
    areaName: json.areaName || null,
    latitude: json.latitude,
    longitude: json.longitude,
    scheduledAt: json.scheduledAt,
    expiresAt: new Date(postedAt.getTime() + PLAN_LIFETIME_MS).toISOString(),
    timeLabel: planTimeLabel(postedAt),
    preferredGender: json.preferredGender,
    status: json.status,
    createdAt: json.createdAt,
    owner: json.user ? formatPerson(json.user) : undefined,
    ...extra,
  };
}

async function findActivePlanOf(userId) {
  return UserPlan.findOne({
    where: { userId, status: 'active', scheduledAt: { [Op.gte]: visibleSince() } },
    include: [{ model: City, as: 'city', attributes: ['id', 'name'] }],
    order: [['createdAt', 'DESC']],
  });
}

/** The caller's active plan plus everyone who tapped "Interested". */
async function getMyPlan(userId) {
  const plan = await findActivePlanOf(userId);
  if (!plan) return null;
  const interests = await PlanInterest.findAll({
    where: { planId: plan.id, status: INTEREST.INTERESTED },
    include: [{ model: User, as: 'user', attributes: ownerAttributes }],
    order: [['updatedAt', 'DESC']],
  });
  return formatPlan(plan, {
    interested: interests.map((i) => ({
      ...formatPerson(i.user),
      conversationId: i.conversationId,
      interestedAt: i.updatedAt,
    })),
  });
}

function eligibleAudienceWhere(plan, ownerId) {
  const where = {
    id: { [Op.ne]: ownerId },
    cityId: plan.cityId,
    isActive: true,
    accountStatus: 'active',
    onboardingCompleted: true,
  };
  if (plan.preferredGender && plan.preferredGender !== 'all') where.gender = plan.preferredGender;
  return where;
}

/** Notify same-city users within PLAN_RADIUS_KM of the plan's area (unknown location = same city is enough). */
async function notifyPlanAudience(plan, owner) {
  const blocked = new Set(await getBlockedRelatedUserIds(owner.id));
  const candidates = await User.findAll({
    where: eligibleAudienceWhere(plan, owner.id),
    attributes: ['id', 'latitude', 'longitude'],
    limit: MAX_NOTIFY * 2,
  });
  const recipients = candidates
    .filter((u) => !blocked.has(String(u.id)))
    .filter((u) => {
      const km = haversineKm(plan.latitude, plan.longitude, u.latitude, u.longitude);
      return km == null || km <= PLAN_RADIUS_KM;
    })
    .slice(0, MAX_NOTIFY);

  const where = plan.areaName ? ` · ${plan.areaName}` : '';
  const title = `${owner.firstName} has a ${plan.planName} plan ${plan.planEmoji || ''}`.trim();
  const body = `Today${where}. Interested? Tap to see the plan.`;

  let sent = 0;
  for (const user of recipients) {
    try {
      await createAndEmitNotification({
        recipientId: user.id,
        type: 'plan_new',
        title,
        body,
        data: { planId: plan.id, ownerId: owner.id },
      });
      emitToUser(user.id, 'plan:new', { planId: plan.id });
      sent += 1;
    } catch (err) {
      console.error('[plans] notify failed', user.id, err.message);
    }
  }
  await UserPlan.update({ notifiedCount: sent }, { where: { id: plan.id } });
  return sent;
}

async function createPlan(userId, body = {}) {
  if (body.termsAccepted !== true) {
    throw new AppError('Please accept Terms & Conditions', 400);
  }
  const owner = await User.findByPk(userId, { attributes: ['id', 'firstName', 'isActive'] });
  if (!owner || !owner.isActive) throw new AppError('User not found', 404);

  if (await findActivePlanOf(userId)) {
    throw new AppError(
      'Your plan is live for 24 hours. You can post a new one after it ends, or cancel it.',
      409
    );
  }

  const planType = body.planTypeId ? await PlanType.findByPk(body.planTypeId) : null;
  if (!planType || !planType.isActive) throw new AppError('Please choose your plan', 400);

  const city = body.cityId ? await City.findByPk(body.cityId) : null;
  if (!city || !city.isActive) throw new AppError('Please choose your city', 400);

  const area = body.cityAreaId ? await CityArea.findByPk(body.cityAreaId) : null;
  if (!area || !area.isActive || String(area.cityId) !== String(city.id)) {
    throw new AppError('Please choose an area in this city', 400);
  }

  const preferredGender = String(body.preferredGender || 'all').toLowerCase();
  if (!GENDERS.includes(preferredGender)) {
    throw new AppError('preferredGender must be all, male, or female', 400);
  }

  const { planPostCost } = await coinService.getCoinSettings();
  const plan = await sequelize.transaction(async (transaction) => {
    const now = new Date();
    const created = await UserPlan.create(
      {
        userId,
        planTypeId: planType.id,
        planName: planType.name,
        planEmoji: planType.emoji,
        cityId: city.id,
        cityAreaId: area.id,
        areaName: area.name,
        latitude: area.latitude,
        longitude: area.longitude,
        scheduledAt: now,
        preferredGender,
        status: 'active',
        termsAcceptedAt: now,
      },
      { transaction }
    );
    if (planPostCost > 0) {
      await coinService.applyChange(
        userId,
        {
          amount: -planPostCost,
          type: coinService.COIN_TX_TYPES.PLAN_POST,
          title: `${planType.name} plan posted`,
          referenceId: created.id,
          idempotencyKey: `plan_post:${created.id}`,
        },
        { transaction }
      );
    }
    return created;
  });

  setImmediate(() => {
    notifyPlanAudience(plan, owner).catch((err) => console.error('[plans] notify', err.message));
  });

  await plan.reload({ include: [{ model: City, as: 'city', attributes: ['id', 'name'] }] });
  return formatPlan(plan, { interested: [] });
}

async function cancelPlan(userId, planId) {
  const plan = await UserPlan.findOne({ where: { id: planId, userId } });
  if (!plan) throw new AppError('Plan not found', 404);
  if (plan.status !== 'cancelled') await plan.update({ status: 'cancelled' });
  return { id: plan.id, status: 'cancelled' };
}

function viewerCoords(viewer, query = {}) {
  const lat = query.latitude != null ? Number(query.latitude) : NaN;
  const lng = query.longitude != null ? Number(query.longitude) : NaN;
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  if (viewer.latitude != null && viewer.longitude != null) {
    return { lat: Number(viewer.latitude), lng: Number(viewer.longitude) };
  }
  return { lat: null, lng: null };
}

/** Active plans of other people in the viewer's city within PLAN_RADIUS_KM, soonest first. */
async function listNearbyPlans(userId, query = {}) {
  const viewer = await User.findByPk(userId, {
    attributes: ['id', 'cityId', 'gender', 'latitude', 'longitude'],
  });
  if (!viewer) throw new AppError('User not found', 404);
  const { lat, lng } = viewerCoords(viewer, query);
  const blocked = await getBlockedRelatedUserIds(userId);

  const plans = await UserPlan.findAll({
    where: {
      status: 'active',
      scheduledAt: { [Op.gte]: visibleSince() },
      cityId: viewer.cityId,
      userId: { [Op.notIn]: [userId, ...blocked] },
      preferredGender: { [Op.in]: ['all', viewer.gender] },
    },
    include: [
      { model: User, as: 'user', attributes: ownerAttributes, where: { isActive: true, accountStatus: 'active' } },
      { model: City, as: 'city', attributes: ['id', 'name'] },
    ],
    order: [['scheduledAt', 'DESC']],
    limit: 200,
  });

  const myInterests = plans.length
    ? await PlanInterest.findAll({
        where: { userId, planId: { [Op.in]: plans.map((p) => p.id) } },
        attributes: ['planId', 'status', 'conversationId'],
      })
    : [];
  const interestByPlan = new Map(myInterests.map((i) => [String(i.planId), i]));

  return plans
    .map((plan) => {
      const mine = interestByPlan.get(String(plan.id));
      return formatPlan(plan, {
        distanceKm: haversineKm(lat, lng, plan.latitude, plan.longitude),
        myInterest: mine?.status || null,
        conversationId: mine?.status === INTEREST.INTERESTED ? mine.conversationId : null,
      });
    })
    .filter((p) => p.myInterest !== INTEREST.NOT_INTERESTED)
    .filter((p) => p.distanceKm == null || p.distanceKm <= PLAN_RADIUS_KM);
}

async function respondToPlan(userId, planId, status) {
  if (!Object.values(INTEREST).includes(status)) {
    throw new AppError('status must be interested or not_interested', 400);
  }
  const plan = await UserPlan.findByPk(planId);
  if (!plan || plan.status !== 'active' || new Date(plan.scheduledAt) < visibleSince()) {
    throw new AppError('This plan is no longer available', 404);
  }
  if (String(plan.userId) === String(userId)) {
    throw new AppError('This is your own plan', 400);
  }
  const viewer = await User.findByPk(userId, { attributes: ['id', 'firstName', 'gender'] });
  if (!viewer) throw new AppError('User not found', 404);
  if (plan.preferredGender !== 'all' && plan.preferredGender !== viewer.gender) {
    throw new AppError('This plan is not open to you', 403);
  }
  if (await isBlockedEitherWay(userId, plan.userId)) {
    throw new AppError('This plan is not available', 403);
  }

  const [interest] = await PlanInterest.findOrCreate({
    where: { planId, userId },
    defaults: { status },
  });
  const wasInterested = interest.status === INTEREST.INTERESTED && interest.conversationId;

  if (status === INTEREST.NOT_INTERESTED) {
    await interest.update({ status });
    return { planId, status, conversationId: null };
  }

  const conversation = await ensureConversationBetween(userId, plan.userId);
  await interest.update({ status, conversationId: conversation?.id || null });

  if (!wasInterested) {
    await createAndEmitNotification({
      recipientId: plan.userId,
      type: 'plan_interest',
      title: `${viewer.firstName} is interested in your ${plan.planName} plan`,
      body: 'Say hi — your chat is ready.',
      data: { planId, userId, conversationId: conversation?.id || null },
    });
    emitToUser(plan.userId, 'plan:interest', { planId, userId });
  }

  return { planId, status, conversationId: conversation?.id || null };
}

module.exports = {
  PLAN_RADIUS_KM,
  PLAN_LIFETIME_HOURS,
  findActivePlanOf,
  formatPlan,
  planTimeLabel,
  getMyPlan,
  createPlan,
  cancelPlan,
  listNearbyPlans,
  respondToPlan,
  notifyPlanAudience,
};
