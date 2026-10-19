const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const {
  Admin,
  User,
  City,
  Booking,
  PlatformSetting,
  CompanionCategory,
  WithdrawalRequest,
} = require('../../../models');
const legalService = require('../common/legalService');
const AppError = require('../../../utils/AppError');
const { signAdminToken } = require('../../../utils/jwt');
const { BOOKING_STATUS } = require('../../../constants/bookingStatus');
const { BIO_STATUS, BIO_STATUS_VALUES } = require('../../../constants/bioStatus');
const { RELIGIONS, normalizeReligion } = require('../../../constants/religions');
const storageService = require('../../storageService');
const normalizeMobile = require('../../../utils/normalizeMobile');
const { assertMeetsAgeRequirement } = require('../../../utils/ageRequirements');
const creatorProfile = require('../user/creatorProfileService');

const USER_ACCOUNT_STATUSES = ['active', 'inactive', 'blocked', 'suspended'];
const INACTIVE_STATUSES = ['inactive', 'blocked', 'suspended'];
const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const userSummaryAttributes = ['id', 'firstName', 'lastName', 'mobileNumber', 'photos'];
const bookingUserInclude = [
  { model: User, as: 'sender', attributes: userSummaryAttributes },
  { model: User, as: 'receiver', attributes: userSummaryAttributes },
];

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

function paginationMeta(page, limit, total) {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

function displayStatus(user) {
  const accountStatus = user.accountStatus || (user.isActive ? 'active' : 'inactive');
  if (accountStatus === 'active' && !user.isActive) {
    return 'inactive';
  }
  return accountStatus;
}

function normalizePhotoUrls(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(Boolean)
    .map((p) => storageService.getPublicUrl(String(p)))
    .filter(Boolean);
}

function normalizeAvailability(input) {
  const slot = { active: false, start: '09:00', end: '18:00' };
  const base = WEEKDAY_KEYS.reduce((acc, key) => {
    acc[key] = { ...slot };
    return acc;
  }, {});
  if (!input || typeof input !== 'object') return base;
  for (const key of WEEKDAY_KEYS) {
    const day = input[key];
    if (!day || typeof day !== 'object') continue;
    base[key] = {
      active: Boolean(day.active),
      start: typeof day.start === 'string' && day.start ? day.start : '09:00',
      end: typeof day.end === 'string' && day.end ? day.end : '18:00',
    };
  }
  return base;
}

function calcAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function formatUserListItem(user, extra = {}) {
  const json = user.toJSON ? user.toJSON() : user;
  const status = displayStatus(json);
  const listStatus =
    status === 'active' ? 'active' : status === 'inactive' ? 'inactive' : status;
  const photos = normalizePhotoUrls(json.photos);
  return {
    id: json.id,
    firstName: json.firstName,
    lastName: json.lastName,
    fullName: `${json.firstName} ${json.lastName}`.trim(),
    mobileNumber: json.mobileNumber,
    email: json.email || null,
    gender: json.gender,
    dateOfBirth: json.dateOfBirth,
    age: calcAge(json.dateOfBirth),
    city: json.city || null,
    cityName: json.city ? json.city.name : null,
    isActive: json.isActive,
    status: listStatus,
    hasUserProfile: json.hasUserProfile,
    hasCompanionProfile: json.hasCompanionProfile,
    ...creatorProfile.creatorInfo(json),
    photos,
    photoUrl: photos[0] || null,
    cityId: json.cityId || (json.city ? json.city.id : null),
    createdAt: json.createdAt,
    lastActiveAt: json.lastActiveAt || null,
    latitude: json.latitude != null ? Number(json.latitude) : null,
    longitude: json.longitude != null ? Number(json.longitude) : null,
    locationUpdatedAt: json.locationUpdatedAt || null,
    ...extra,
  };
}

function formatUserDetail(user, { services = [] } = {}) {
  const json = user.toJSON ? user.toJSON() : user;
  const base = formatUserListItem(user);
  return {
    ...base,
    pincode: json.pincode || null,
    upiId: json.upiId || null,
    aboutMe: json.aboutMe || '',
    pendingBio: json.pendingBio || null,
    bioStatus: json.bioStatus || 'none',
    education: json.education || null,
    profession: json.profession || null,
    religion: json.religion || null,
    drinking: json.drinking || null,
    smoking: json.smoking || null,
    eating: json.eating || null,
    relationshipStatus: json.relationshipStatus || null,
    lookingFor: json.lookingFor || null,
    interests: Array.isArray(json.interests) ? json.interests.filter(Boolean) : [],
    selectedServiceIds: Array.isArray(json.selectedServiceIds)
      ? json.selectedServiceIds
      : [],
    services,
    availability: normalizeAvailability(json.availability),
    hideAge: !!json.hideAge,
    photoVerified: !!json.photoVerified,
    facebookVerified: !!json.facebookVerified,
    kycVerified: !!json.kycVerified,
    kycFileName: json.kycFileName || null,
    freeBookingCreatesLeft: Number(json.freeBookingCreatesLeft ?? 0),
    freeBookingAcceptsLeft: Number(json.freeBookingAcceptsLeft ?? 0),
    updatedAt: json.updatedAt || null,
  };
}

function bookingPersonBrief(user) {
  if (!user) return null;
  const j = user.toJSON ? user.toJSON() : user;
  const name = `${j.firstName || ''} ${j.lastName || ''}`.trim();
  return {
    id: j.id,
    name: name || j.mobileNumber || null,
    firstName: j.firstName,
    lastName: j.lastName,
    mobileNumber: j.mobileNumber,
    email: j.email || null,
  };
}

function formatBookingAdminItem(booking) {
  const json = booking.toJSON ? booking.toJSON() : booking;
  const category = json.category
    ? {
        id: json.category.id,
        name: json.category.name,
        emoji: json.category.emoji || null,
      }
    : null;
  const city = json.city
    ? { id: json.city.id, name: json.city.name }
    : json.cityName
      ? { id: json.cityId, name: json.cityName }
      : null;

  return {
    id: json.id,
    status: json.status,
    paymentStatus: json.paymentStatus || 'unpaid',
    amount: json.amount != null ? Number(json.amount) : 0,
    scheduledAt: json.scheduledAt,
    durationMinutes: json.durationMinutes,
    location: json.location,
    placeId: json.placeId || null,
    locationLat: json.locationLat != null ? Number(json.locationLat) : null,
    locationLng: json.locationLng != null ? Number(json.locationLng) : null,
    notes: json.notes,
    cityId: json.cityId,
    cityName: city ? city.name : null,
    city,
    categoryId: json.categoryId || null,
    categoryName: category ? category.name : null,
    category,
    preferredGender: json.preferredGender || null,
    bookingPolicyAccepted: !!json.bookingPolicyAccepted,
    confirmedAt: json.confirmedAt || null,
    startedAt: json.startedAt || null,
    endsAt: json.endsAt || null,
    paidAt: json.paidAt || null,
    paymentDueAt: json.paymentDueAt || null,
    cancelledAt: json.cancelledAt || null,
    cancelReason: json.cancelReason || null,
    sender: json.sender
      ? {
          id: json.sender.id,
          firstName: json.sender.firstName,
          lastName: json.sender.lastName,
          mobileNumber: json.sender.mobileNumber,
        }
      : null,
    receiver: json.receiver
      ? {
          id: json.receiver.id,
          firstName: json.receiver.firstName,
          lastName: json.receiver.lastName,
          mobileNumber: json.receiver.mobileNumber,
        }
      : null,
    user: bookingPersonBrief(json.sender),
    companion: bookingPersonBrief(json.receiver),
    bothSideStatus: {
      userMeetVerified: !!json.userCodeVerifiedAt,
      companionMeetVerified: !!json.companionCodeVerifiedAt,
      userArrivedAt: json.userCodeVerifiedAt || null,
      companionArrivedAt: json.companionCodeVerifiedAt || null,
    },
    createdAt: json.createdAt,
    updatedAt: json.updatedAt,
  };
}

function buildUserWhere(query) {
  const where = {};
  if (query.companionOnly === '1' || query.companionOnly === true) {
    where.hasCompanionProfile = true;
  }
  if (query.usersOnly === '1' || query.usersOnly === true) {
    where.hasUserProfile = true;
  }
  const status = query.status ? String(query.status).toLowerCase() : null;
  if (status === 'active') {
    where.isActive = true;
  } else if (status && INACTIVE_STATUSES.includes(status)) {
    where.isActive = false;
    if (status !== 'inactive') {
      where.accountStatus = status;
    }
  } else if (status === 'inactive') {
    where.isActive = false;
  }

  const gender = query.gender ? String(query.gender).toLowerCase().trim() : '';
  if (gender && ['male', 'female', 'other'].includes(gender)) {
    where.gender = gender;
  }

  const search = query.search ? String(query.search).trim() : '';
  if (search) {
    where[Op.or] = [
      { firstName: { [Op.iLike]: `%${search}%` } },
      { lastName: { [Op.iLike]: `%${search}%` } },
      { mobileNumber: { [Op.iLike]: `%${search}%` } },
      { creatorHandle: { [Op.iLike]: `%${search.replace(/^@/, '')}%` } },
    ];
  }
  return where;
}

async function login(email, password) {
  if (!email || !password) {
    throw new AppError('Email and password are required', 400);
  }
  const admin = await Admin.findOne({
    where: { email: String(email).trim().toLowerCase() },
  });
  if (!admin) {
    throw new AppError('Invalid email or password', 401);
  }
  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    throw new AppError('Invalid email or password', 401);
  }
  const token = signAdminToken(admin);
  const adminSafe = admin.toSafeJSON();
  return { token, admin: adminSafe, superAdmin: adminSafe };
}

async function getMe(adminId) {
  const admin = await Admin.findByPk(adminId);
  if (!admin) {
    throw new AppError('Admin not found', 404);
  }
  return admin.toSafeJSON();
}

async function updateProfile(adminId, { name }) {
  if (!name || !String(name).trim()) {
    throw new AppError('Name is required', 400);
  }
  const admin = await Admin.findByPk(adminId);
  if (!admin) {
    throw new AppError('Admin not found', 404);
  }
  admin.name = String(name).trim();
  await admin.save();
  return admin.toSafeJSON();
}

async function changePassword(adminId, { currentPassword, newPassword }) {
  if (!currentPassword || !newPassword) {
    throw new AppError('currentPassword and newPassword are required', 400);
  }
  if (String(newPassword).length < 6) {
    throw new AppError('New password must be at least 6 characters', 400);
  }
  const admin = await Admin.findByPk(adminId);
  if (!admin) {
    throw new AppError('Admin not found', 404);
  }
  const valid = await bcrypt.compare(currentPassword, admin.passwordHash);
  if (!valid) {
    throw new AppError('Current password is incorrect', 401);
  }
  admin.passwordHash = await bcrypt.hash(String(newPassword), 10);
  await admin.save();
  return { message: 'Password updated successfully' };
}

async function countUsersByStatus(extraWhere = {}) {
  const [active, inactive, suspended, blocked, total, profileCompleted] = await Promise.all([
    User.count({ where: { ...extraWhere, isActive: true } }),
    User.count({
      where: { ...extraWhere, isActive: false, accountStatus: 'inactive' },
    }),
    User.count({ where: { ...extraWhere, accountStatus: 'suspended' } }),
    User.count({ where: { ...extraWhere, accountStatus: 'blocked' } }),
    User.count({ where: extraWhere }),
    User.count({ where: { ...extraWhere, onboardingCompleted: true } }),
  ]);
  return {
    total,
    profileCompleted,
    byStatus: { active, inactive, suspended, blocked },
  };
}

async function getDashboardStats() {
  const [
    usersBlock,
    companiesBlock,
    bookingsTotal,
    bookingsPending,
    bookingsAccepted,
    bookingsDeclined,
    bookingsCancelled,
    bookingsCompleted,
    citiesTotal,
    citiesActive,
    bioPending,
    wdPending,
    wdApproved,
    wdRejected,
    wdPaidSum,
  ] = await Promise.all([
    countUsersByStatus({ hasUserProfile: true }),
    countUsersByStatus({ hasCompanionProfile: true }),
    Booking.count(),
    Booking.count({ where: { status: BOOKING_STATUS.PENDING } }),
    Booking.count({ where: { status: BOOKING_STATUS.ACCEPTED } }),
    Booking.count({ where: { status: BOOKING_STATUS.DECLINED } }),
    Booking.count({ where: { status: BOOKING_STATUS.CANCELLED } }),
    Booking.count({ where: { status: BOOKING_STATUS.COMPLETED } }),
    City.count(),
    City.count({ where: { isActive: true } }),
    User.count({ where: { bioStatus: BIO_STATUS.PENDING } }),
    WithdrawalRequest.count({ where: { status: 'pending' } }),
    WithdrawalRequest.count({ where: { status: 'approved' } }),
    WithdrawalRequest.count({ where: { status: 'rejected' } }),
    WithdrawalRequest.sum('amount', { where: { status: 'approved' } }),
  ]);

  const bookings = {
    total: bookingsTotal,
    pending: bookingsPending,
    accepted: bookingsAccepted,
    declined: bookingsDeclined,
    cancelled: bookingsCancelled,
    completed: bookingsCompleted,
  };

  const cities = { total: citiesTotal, active: citiesActive };

  return {
    users: usersBlock,
    companies: companiesBlock,
    bookings,
    cities,
    totals: {
      users: usersBlock.total,
      companies: companiesBlock.total,
      all: usersBlock.total + companiesBlock.total,
      bookings: bookingsTotal,
      cities: citiesTotal,
    },
    bioRequests: {
      pending: bioPending,
      users: bioPending,
      companies: 0,
    },
    withdrawals: {
      pending: wdPending,
      processing: wdApproved,
      completed: wdApproved,
      failedOrRejected: wdRejected,
      totalPaidOut: Number(wdPaidSum || 0),
    },
  };
}

async function listUsersPaginated(query) {
  const { page, limit, offset } = parsePagination(query);
  const q = { ...query };
  if (!q.companionOnly && !q.usersOnly) {
    q.usersOnly = '1';
  }
  const where = buildUserWhere(q);
  const { rows, count } = await User.findAndCountAll({
    where,
    include: [{ model: City, as: 'city', attributes: ['id', 'name'] }],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });
  return {
    items: rows.map((u) => formatUserListItem(u)),
    pagination: paginationMeta(page, limit, count),
  };
}

async function getUserById(id) {
  const user = await User.findByPk(id, {
    include: [{ model: City, as: 'city', attributes: ['id', 'name'] }],
  });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const serviceIds = Array.isArray(user.selectedServiceIds)
    ? user.selectedServiceIds.filter(Boolean)
    : [];
  const services = await resolveServicesForIds(serviceIds);

  const sent = await Booking.findAll({
    where: { senderId: id },
    include: [
      ...bookingUserInclude,
      { model: City, as: 'city', attributes: ['id', 'name'], required: false },
    ],
    order: [['createdAt', 'DESC']],
    limit: 20,
  });
  const received = await Booking.findAll({
    where: { receiverId: id },
    include: [
      ...bookingUserInclude,
      { model: City, as: 'city', attributes: ['id', 'name'], required: false },
    ],
    order: [['createdAt', 'DESC']],
    limit: 20,
  });

  const recentBookings = [...sent, ...received]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 20)
    .map((b) => {
      const item = formatBookingAdminItem(b);
      item.direction = b.senderId === id ? 'sent' : 'received';
      return item;
    });

  return {
    ...formatUserDetail(user, { services }),
    recentBookings,
  };
}

async function updateUserStatus(id, { status }) {
  const normalized = status ? String(status).toLowerCase() : null;
  if (!normalized || !USER_ACCOUNT_STATUSES.includes(normalized)) {
    throw new AppError(
      'status must be one of: active, inactive, blocked, suspended',
      400
    );
  }
  const user = await User.findByPk(id);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  user.accountStatus = normalized;
  user.isActive = normalized === 'active';
  await user.save();
  return formatUserListItem(
    await user.reload({ include: [{ model: City, as: 'city', attributes: ['id', 'name'] }] })
  );
}

const STRING_PROFILE_FIELDS = [
  'email',
  'pincode',
  'upiId',
  'aboutMe',
  'education',
  'profession',
  'drinking',
  'smoking',
  'eating',
  'relationshipStatus',
  'lookingFor',
  'kycFileName',
];

const BOOL_PROFILE_FIELDS = [
  'hideAge',
  'photoVerified',
  'facebookVerified',
  'kycVerified',
  'hasUserProfile',
  'hasCompanionProfile',
  'isCreator',
];

function toRelativePhotoPath(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s.startsWith('/public/')) return s;
  try {
    const u = new URL(s);
    if (u.pathname.startsWith('/public/')) return u.pathname;
  } catch {
    /* ignore */
  }
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  return null;
}

function normalizeAdminPhotos(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((p) => toRelativePhotoPath(p))
    .filter(Boolean)
    .slice(0, 5);
}

function normalizeStringArray(input, max = 50) {
  if (!Array.isArray(input)) return [];
  return input
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .slice(0, max);
}

async function resolveServicesForIds(serviceIds) {
  const ids = normalizeStringArray(serviceIds, 50);
  if (!ids.length) return [];
  const rows = await CompanionCategory.findAll({
    where: { id: { [Op.in]: ids } },
    attributes: ['id', 'name', 'isActive'],
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((sid) => {
    const row = byId.get(sid);
    if (!row) return { id: sid, name: sid, isActive: false };
    return { id: row.id, name: row.name, isActive: !!row.isActive };
  });
}

async function validateServiceIds(ids) {
  const normalized = normalizeStringArray(ids, 50);
  if (!normalized.length) return [];
  const found = await CompanionCategory.findAll({
    where: { id: { [Op.in]: normalized } },
    attributes: ['id'],
  });
  const valid = new Set(found.map((r) => r.id));
  const missing = normalized.filter((id) => !valid.has(id));
  if (missing.length) {
    throw new AppError('One or more selected services are invalid', 400);
  }
  return normalized;
}

/**
 * creatorHandle / creatorExpiresAt / creatorDurationMonths — admin only.
 * Turning a creator on without a validity defaults to 1 month.
 */
async function applyCreatorFields(user, body, patch) {
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

  if (has('creatorHandle')) {
    const raw = String(body.creatorHandle || '').trim();
    patch.creatorHandle = raw
      ? await creatorProfile.normalizeHandleForUser(raw, user?.id || null)
      : null;
  }

  if (has('creatorDurationMonths') && body.creatorDurationMonths) {
    const months = creatorProfile.assertDurationMonths(body.creatorDurationMonths);
    patch.creatorExpiresAt = creatorProfile.addMonths(new Date(), months);
    patch.isCreator = true;
  } else if (has('creatorExpiresAt')) {
    if (body.creatorExpiresAt) {
      const d = new Date(body.creatorExpiresAt);
      if (Number.isNaN(d.getTime())) throw new AppError('Invalid creator expiry date', 400);
      patch.creatorExpiresAt = d;
    } else {
      patch.creatorExpiresAt = null;
    }
  }

  const willBeCreator = patch.isCreator ?? Boolean(user?.isCreator);
  if (!willBeCreator) return;

  const expiry = patch.creatorExpiresAt !== undefined ? patch.creatorExpiresAt : user?.creatorExpiresAt;
  if (patch.isCreator && (!expiry || new Date(expiry).getTime() <= Date.now())) {
    patch.creatorExpiresAt = creatorProfile.addMonths(new Date(), 1);
  }

  const handle = patch.creatorHandle !== undefined ? patch.creatorHandle : user?.creatorHandle;
  if (!handle) {
    patch.creatorHandle = await creatorProfile.generateUniqueHandle(
      patch.firstName || user?.firstName || body.firstName,
      patch.lastName || user?.lastName || body.lastName
    );
  }
}

async function applyUserBody(user, body = {}, { isCreate = false } = {}) {
  const patch = {};

  if (Object.prototype.hasOwnProperty.call(body, 'firstName') || isCreate) {
    const firstName = String(body.firstName || '').trim();
    if (!firstName) throw new AppError('firstName is required', 400);
    patch.firstName = firstName;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'lastName') || isCreate) {
    const lastName = String(body.lastName || '').trim();
    if (!lastName) throw new AppError('lastName is required', 400);
    patch.lastName = lastName;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'gender') || isCreate) {
    const gender = String(body.gender || '').toLowerCase();
    if (!['male', 'female', 'other'].includes(gender)) {
      throw new AppError('Invalid gender. Allowed: male, female, other', 400);
    }
    patch.gender = gender;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'dateOfBirth') || isCreate) {
    if (!body.dateOfBirth) throw new AppError('dateOfBirth is required', 400);
    patch.dateOfBirth = body.dateOfBirth;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'cityId') || isCreate) {
    if (!body.cityId) throw new AppError('cityId is required', 400);
    const city = await City.findByPk(body.cityId);
    if (!city) throw new AppError('Invalid city', 400);
    patch.cityId = body.cityId;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'mobileNumber')) {
    const mobileNumber = normalizeMobile(body.mobileNumber);
    const existing = await User.findOne({
      where: {
        mobileNumber,
        ...(user?.id ? { id: { [Op.ne]: user.id } } : {}),
      },
    });
    if (existing) {
      throw new AppError('User already exists with this mobile number', 409);
    }
    patch.mobileNumber = mobileNumber;
  }

  for (const key of STRING_PROFILE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      const raw = body[key];
      patch[key] = raw == null ? null : String(raw).trim() || null;
    }
  }

  for (const key of BOOL_PROFILE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      patch[key] = Boolean(body[key]);
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'religion')) {
    const raw = body.religion == null ? '' : String(body.religion).trim();
    if (!raw) {
      patch.religion = null;
    } else {
      const religion = normalizeReligion(raw);
      if (!religion) {
        throw new AppError(`Invalid religion. Allowed: ${RELIGIONS.join(', ')}`, 400);
      }
      patch.religion = religion;
    }
  }

  await applyCreatorFields(user, body, patch);

  for (const key of ['freeBookingCreatesLeft', 'freeBookingAcceptsLeft']) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      const n = Number(body[key]);
      if (!Number.isInteger(n) || n < 0 || n > 100) {
        throw new AppError(`${key} must be a whole number between 0 and 100`, 400);
      }
      patch[key] = n;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'interests')) {
    patch.interests = normalizeStringArray(body.interests, 30);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'photos')) {
    patch.photos = normalizeAdminPhotos(body.photos);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'selectedServiceIds')) {
    patch.selectedServiceIds = await validateServiceIds(body.selectedServiceIds);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'availability')) {
    patch.availability = normalizeAvailability(body.availability);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    const status = String(body.status || '').toLowerCase();
    if (!USER_ACCOUNT_STATUSES.includes(status)) {
      throw new AppError(
        'status must be one of: active, inactive, blocked, suspended',
        400
      );
    }
    patch.accountStatus = status;
    patch.isActive = status === 'active';
  }

  const gender = patch.gender || user?.gender;
  const dob = patch.dateOfBirth || user?.dateOfBirth;
  if (gender && dob) {
    assertMeetsAgeRequirement(gender, dob);
  }

  return patch;
}

async function createUser(body = {}) {
  if (!body.mobileNumber) {
    throw new AppError('mobileNumber is required', 400);
  }
  const mobileNumber = normalizeMobile(body.mobileNumber);
  const existing = await User.findOne({ where: { mobileNumber } });
  if (existing) {
    throw new AppError('User already exists with this mobile number', 409);
  }

  const patch = await applyUserBody(null, { ...body, mobileNumber }, { isCreate: true });
  patch.mobileNumber = mobileNumber;
  if (patch.accountStatus === undefined) {
    patch.accountStatus = 'active';
    patch.isActive = true;
  }
  if (patch.hasUserProfile === undefined) patch.hasUserProfile = true;
  if (patch.hasCompanionProfile === undefined) patch.hasCompanionProfile = true;
  if (patch.interests === undefined) patch.interests = [];
  if (patch.photos === undefined) patch.photos = [];
  if (patch.selectedServiceIds === undefined) patch.selectedServiceIds = [];
  if (patch.availability === undefined) patch.availability = normalizeAvailability({});

  const user = await User.create(patch);
  await user.reload({ include: [{ model: City, as: 'city', attributes: ['id', 'name'] }] });
  const services = await resolveServicesForIds(user.selectedServiceIds);
  return formatUserDetail(user, { services });
}

async function updateUser(id, body = {}) {
  const user = await User.findByPk(id, {
    include: [{ model: City, as: 'city', attributes: ['id', 'name'] }],
  });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const patch = await applyUserBody(user, body, { isCreate: false });
  if (!Object.keys(patch).length) {
    throw new AppError('No fields to update', 400);
  }

  await user.update(patch);
  await user.reload({ include: [{ model: City, as: 'city', attributes: ['id', 'name'] }] });
  const services = await resolveServicesForIds(user.selectedServiceIds);
  return formatUserDetail(user, { services });
}

async function listCompaniesPaginated(query) {
  const result = await listUsersPaginated({
    ...query,
    companionOnly: '1',
  });
  result.items = result.items.map((item) => ({
    ...item,
    role: 'companion',
  }));
  return result;
}

function cityWhere(query = {}) {
  const where = {};
  const search = query.search ? String(query.search).trim() : '';
  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { state: { [Op.iLike]: `%${search}%` } },
    ];
  }
  if (query.isActive === 'true' || query.isActive === true) where.isActive = true;
  if (query.isActive === 'false' || query.isActive === false) where.isActive = false;
  return where;
}

async function listCities(query) {
  const pageParam = query.page !== undefined ? parseInt(query.page, 10) : null;
  const limitParam = query.limit !== undefined ? parseInt(query.limit, 10) : null;
  const where = cityWhere(query);

  if (pageParam || limitParam) {
    const page = Math.max(1, pageParam || 1);
    const limit = Math.min(100, Math.max(1, limitParam || 20));
    const offset = (page - 1) * limit;
    const [{ rows, count }, activeCount] = await Promise.all([
      City.findAndCountAll({
        where,
        order: [
          ['sortOrder', 'ASC'],
          ['name', 'ASC'],
        ],
        limit,
        offset,
      }),
      City.count({ where: { isActive: true } }),
    ]);
    return {
      items: rows,
      pagination: paginationMeta(page, limit, count),
      activeCount,
    };
  }

  const rows = await City.findAll({
    where,
    order: [
      ['sortOrder', 'ASC'],
      ['name', 'ASC'],
    ],
  });
  return { items: rows };
}

async function createCity(body) {
  const { name, state, isActive, sortOrder } = body || {};
  if (!name || !String(name).trim()) {
    throw new AppError('City name is required', 400);
  }
  const trimmed = String(name).trim();
  const stateValue = state && String(state).trim() ? String(state).trim() : null;
  const existing = await City.findOne({ where: { name: trimmed, state: stateValue } });
  if (existing) {
    throw new AppError('City with this name already exists', 409);
  }
  let order = sortOrder;
  if (order === undefined || order === null || order === '' || Number(order) === 0) {
    const maxSort = await City.max('sortOrder');
    order = Number.isFinite(maxSort) ? maxSort + 1 : 1;
  }
  return City.create({
    name: trimmed,
    state: stateValue,
    isActive: isActive !== undefined ? Boolean(isActive) : true,
    sortOrder: Number(order),
  });
}

async function updateCity(id, updates) {
  const city = await City.findByPk(id);
  if (!city) {
    throw new AppError('City not found', 404);
  }
  const { name, state, isActive, sortOrder } = updates;
  if (state !== undefined) {
    city.state = state && String(state).trim() ? String(state).trim() : null;
  }
  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) {
      throw new AppError('City name cannot be empty', 400);
    }
    city.name = trimmed;
  }
  if (name !== undefined || state !== undefined) {
    const duplicate = await City.findOne({ where: { name: city.name, state: city.state } });
    if (duplicate && duplicate.id !== city.id) {
      throw new AppError('City with this name already exists', 409);
    }
  }
  if (isActive !== undefined) {
    city.isActive = Boolean(isActive);
  }
  if (sortOrder !== undefined) {
    city.sortOrder = Number(sortOrder);
  }
  await city.save();
  return city;
}

/**
 * Activate / deactivate many cities at once.
 * Pass `ids` for a selection, or `all: true` (optionally with `search`) for every matching city.
 */
async function bulkSetCityStatus(body = {}) {
  const isActive = body.isActive === true || body.isActive === 'true';
  if (body.isActive === undefined) {
    throw new AppError('isActive is required', 400);
  }
  let where;
  if (Array.isArray(body.ids) && body.ids.length) {
    where = { id: { [Op.in]: body.ids.map(String).slice(0, 1000) } };
  } else if (body.all === true || body.all === 'true') {
    where = cityWhere({ search: body.search });
  } else {
    throw new AppError('Select cities or choose all', 400);
  }
  const [updated] = await City.update({ isActive }, { where });
  return { updated, isActive };
}

async function deleteCity(id) {
  const city = await City.findByPk(id);
  if (!city) {
    throw new AppError('City not found', 404);
  }
  const userCount = await User.count({ where: { cityId: id } });
  if (userCount > 0) {
    throw new AppError('Cannot delete city: users are assigned to this city', 400);
  }
  await city.destroy();
  return { message: 'City deleted' };
}

async function listBookingsPaginated(query) {
  const { page, limit, offset } = parsePagination(query);
  const and = [];
  if (query.status && String(query.status).toLowerCase() !== 'all') {
    and.push({ status: String(query.status).toLowerCase() });
  }
  if (query.paymentStatus && String(query.paymentStatus).toLowerCase() !== 'all') {
    and.push({ paymentStatus: String(query.paymentStatus).toLowerCase() });
  }
  const search = query.search ? String(query.search).trim() : '';
  if (search) {
    const q = `%${search}%`;
    and.push({
      [Op.or]: [
        { '$sender.firstName$': { [Op.iLike]: q } },
        { '$sender.lastName$': { [Op.iLike]: q } },
        { '$sender.mobileNumber$': { [Op.iLike]: q } },
        { '$receiver.firstName$': { [Op.iLike]: q } },
        { '$receiver.lastName$': { [Op.iLike]: q } },
        { '$receiver.mobileNumber$': { [Op.iLike]: q } },
      ],
    });
  }
  const where = and.length ? { [Op.and]: and } : {};

  const { rows, count } = await Booking.findAndCountAll({
    where,
    include: [
      { model: User, as: 'sender', attributes: userSummaryAttributes, required: false },
      { model: User, as: 'receiver', attributes: userSummaryAttributes, required: false },
      { model: City, as: 'city', attributes: ['id', 'name'], required: false },
      {
        model: CompanionCategory,
        as: 'category',
        attributes: ['id', 'name', 'emoji'],
        required: false,
      },
    ],
    order: [['scheduledAt', 'DESC']],
    distinct: true,
    subQuery: false,
    limit,
    offset,
  });

  return {
    items: rows.map(formatBookingAdminItem),
    pagination: paginationMeta(page, limit, count),
  };
}

async function getBookingById(id) {
  const booking = await Booking.findByPk(id, {
    include: [
      ...bookingUserInclude,
      { model: City, as: 'city', attributes: ['id', 'name'], required: false },
      {
        model: CompanionCategory,
        as: 'category',
        attributes: ['id', 'name', 'emoji'],
        required: false,
      },
    ],
  });
  if (!booking) {
    throw new AppError('Booking not found', 404);
  }
  return formatBookingAdminItem(booking);
}

function parseSettingValue(raw) {
  if (raw === null || raw === undefined) {
    return '';
  }
  const str = String(raw);
  if (/^-?\d+(\.\d+)?$/.test(str.trim())) {
    return Number(str);
  }
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

function serializeSettingValue(value) {
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }
  return String(value);
}

async function getPlatformSettings() {
  const rows = await PlatformSetting.findAll();
  const settings = {};
  for (const row of rows) {
    settings[row.key] = parseSettingValue(row.value);
  }
  return settings;
}

async function mergePlatformSettings(updates) {
  if (!updates || typeof updates !== 'object') {
    throw new AppError('Request body must be an object of settings', 400);
  }
  const keys = Object.keys(updates);
  for (const key of keys) {
    const [row] = await PlatformSetting.findOrCreate({
      where: { key },
      defaults: { value: serializeSettingValue(updates[key]) },
    });
    if (row) {
      row.value = serializeSettingValue(updates[key]);
      await row.save();
    }
  }
  return getPlatformSettings();
}

async function listBioRequests({ page = 1, limit = 20, status = BIO_STATUS.PENDING, search } = {}) {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (pageNum - 1) * limitNum;
  const bioStatus = BIO_STATUS_VALUES.includes(status) ? status : BIO_STATUS.PENDING;

  const where = { bioStatus };
  if (search && String(search).trim()) {
    const q = `%${String(search).trim()}%`;
    where[Op.or] = [
      { firstName: { [Op.iLike]: q } },
      { lastName: { [Op.iLike]: q } },
      { mobileNumber: { [Op.iLike]: q } },
      { pendingBio: { [Op.iLike]: q } },
    ];
  }

  const { rows, count } = await User.findAndCountAll({
    where,
    include: [{ model: City, as: 'city', attributes: ['id', 'name'] }],
    order: [['updatedAt', 'DESC']],
    limit: limitNum,
    offset,
  });

  return {
    items: rows.map((row) => ({
      ...formatUserListItem(row),
      aboutMe: row.aboutMe || '',
      pendingBio: row.pendingBio || null,
      requestedBio: row.pendingBio || null,
      bioStatus: row.bioStatus || BIO_STATUS.NONE,
      updatedAt: row.updatedAt,
    })),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: count,
      totalPages: Math.ceil(count / limitNum) || 1,
    },
  };
}

async function reviewBioRequest(id, { action } = {}) {
  if (!['approve', 'reject'].includes(action)) {
    throw new AppError('Action must be approve or reject', 400);
  }

  const user = await User.findByPk(id, {
    include: [{ model: City, as: 'city', attributes: ['id', 'name'] }],
  });
  if (!user) throw new AppError('User not found', 404);
  if (user.bioStatus !== BIO_STATUS.PENDING || !user.pendingBio) {
    throw new AppError('No pending bio request for this account', 400);
  }

  if (action === 'approve') {
    user.aboutMe = user.pendingBio;
    user.pendingBio = null;
    user.bioStatus = BIO_STATUS.APPROVED;
  } else {
    user.pendingBio = null;
    user.bioStatus = BIO_STATUS.REJECTED;
  }
  await user.save();

  return {
    ...formatUserDetail(user),
    pendingBio: user.pendingBio,
    bioStatus: user.bioStatus,
  };
}

module.exports = {
  login,
  getMe,
  updateProfile,
  changePassword,
  getDashboardStats,
  listUsersPaginated,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  listCompaniesPaginated,
  listCities,
  createCity,
  updateCity,
  deleteCity,
  bulkSetCityStatus,
  listBookingsPaginated,
  getBookingById,
  listLegalDocuments: legalService.listLegalDocuments,
  updateLegalBySlug: legalService.updateLegalBySlug,
  getPlatformSettings,
  mergePlatformSettings,
  listBioRequests,
  reviewBioRequest,
};
