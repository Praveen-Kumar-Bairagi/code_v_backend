const { User, City, CompanionCategory } = require('../../../models');
const { Op } = require('sequelize');
const AppError = require('../../../utils/AppError');
const storageService = require('../../storageService');
const { creatorInfo } = require('./creatorProfileService');
const {
  BIO_STATUS,
  BIO_STATUS_VALUES,
  assertBioAllowed,
} = require('../../../constants/bioStatus');
const { RELIGIONS, normalizeReligion } = require('../../../constants/religions');

const PROFILE_PHOTO_SLOTS = 5;
const PROFILE_PHOTO_MIN = 2;

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const STRING_FIELDS = [
  'email',
  'pincode',
  'upiId',
  'education',
  'profession',
  'drinking',
  'smoking',
  'eating',
  'relationshipStatus',
  'lookingFor',
  'kycFileName',
];

/** Verification badges are set only by the server / admin, never from the app. */
const BOOL_FIELDS = ['hideAge'];

function defaultAvailability() {
  const slot = { active: false, start: '09:00', end: '18:00' };
  return WEEKDAY_KEYS.reduce((acc, key) => {
    acc[key] = { ...slot };
    return acc;
  }, {});
}

function isStoredPhotoPath(v) {
  if (!v || typeof v !== 'string') return false;
  const s = v.trim();
  if (!s) return false;
  // Never accept inline base64 / local device URIs in JSON body
  if (
    s.startsWith('data:') ||
    s.startsWith('blob:') ||
    s.startsWith('file:') ||
    s.startsWith('content:')
  ) {
    return false;
  }
  return s.startsWith('/public/') || s.startsWith('http://') || s.startsWith('https://');
}

function toRelativePhotoPath(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (s.startsWith('/public/')) return s;
  try {
    const u = new URL(s);
    if (u.pathname.startsWith('/public/')) return u.pathname;
  } catch {
    /* ignore */
  }
  return isStoredPhotoPath(s) ? s : null;
}

function normalizePhotos(input) {
  if (!Array.isArray(input)) return Array(PROFILE_PHOTO_SLOTS).fill(null);
  return Array.from({ length: PROFILE_PHOTO_SLOTS }, (_, i) => {
    const v = input[i];
    if (v == null || v === '') return null;
    return toRelativePhotoPath(v) || (isStoredPhotoPath(String(v)) ? String(v) : null);
  });
}

function countPhotos(photos) {
  return normalizePhotos(photos).filter(Boolean).length;
}

function normalizeAvailability(input) {
  const base = defaultAvailability();
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

function normalizeStringArray(input, max = 50) {
  if (!Array.isArray(input)) return [];
  return input
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .slice(0, max);
}

/**
 * Resume step for incomplete signup (2–5). Null when finished.
 * Advances past steps already satisfied by saved profile data.
 */
function resolveOnboardingStep(user) {
  if (user.onboardingCompleted) return null;

  let step = Number(user.onboardingStep);
  if (!Number.isFinite(step) || step < 2) step = 2;
  if (step > 5) step = 5;

  const photos = countPhotos(normalizePhotos(user.photos));
  const interests = Array.isArray(user.interests) ? user.interests.filter(Boolean) : [];

  if (step <= 2 && photos >= PROFILE_PHOTO_MIN) step = Math.max(step, 3);
  // Selfie verification is not part of signup for now; it stays pending in the profile.
  if (step === 3) step = 4;
  if (step <= 4 && interests.length >= 3) step = Math.max(step, 5);

  return step;
}

function formatProfile(user) {
  const json = user.toJSON ? user.toJSON() : user;
  if (json.city) {
    json.cityName = json.city.name;
  }
  const stored = normalizePhotos(json.photos);
  const interests = Array.isArray(json.interests) ? json.interests : [];
  json.interests = interests;
  json.selectedServiceIds = Array.isArray(json.selectedServiceIds)
    ? json.selectedServiceIds
    : [];
  json.availability = normalizeAvailability(json.availability);
  json.fullName = [json.firstName, json.lastName].filter(Boolean).join(' ').trim();
  json.googleLinked = Boolean(json.googleUid);
  delete json.googleUid;
  json.bioStatus = BIO_STATUS_VALUES.includes(json.bioStatus)
    ? json.bioStatus
    : BIO_STATUS.NONE;
  json.pendingBio = json.pendingBio || null;
  json.aboutMe = json.aboutMe || '';
  json.onboardingCompleted = Boolean(json.onboardingCompleted);
  json.onboardingStep = resolveOnboardingStep({
    ...json,
    photos: stored,
    interests,
  });
  json.photos = stored.map((p) => (p ? storageService.getPublicUrl(p) : null));
  Object.assign(json, creatorInfo(json));
  return json;
}

async function getProfile(userId) {
  const user = await User.findByPk(userId, {
    include: [{ model: City, as: 'city', attributes: ['id', 'name'] }],
  });
  if (!user) throw new AppError('User not found', 404);
  if (!user.isActive) throw new AppError('Account is deactivated', 403);
  return formatProfile(user);
}

async function updateProfile(userId, body = {}) {
  const user = await User.findByPk(userId, {
    include: [{ model: City, as: 'city', attributes: ['id', 'name'] }],
  });
  if (!user) throw new AppError('User not found', 404);
  if (!user.isActive) throw new AppError('Account is deactivated', 403);

  const patch = {};

  for (const key of STRING_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      const raw = body[key];
      patch[key] = raw == null ? null : String(raw).trim() || null;
    }
  }

  for (const key of BOOL_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      patch[key] = Boolean(body[key]);
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'religion')) {
    const religion = normalizeReligion(body.religion);
    if (!religion) {
      throw new AppError(`Religion is required. Allowed: ${RELIGIONS.join(', ')}`, 400);
    }
    if (user.religion && user.religion !== religion) {
      throw new AppError('Religion is set at signup and cannot be changed', 400);
    }
    if (!user.religion) patch.religion = religion;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'interests')) {
    patch.interests = normalizeStringArray(body.interests, 20);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'availability')) {
    patch.availability = normalizeAvailability(body.availability);
  }

  // Photos via JSON only if they are already stored paths/URLs (not base64)
  if (Object.prototype.hasOwnProperty.call(body, 'photos')) {
    const rawList = Array.isArray(body.photos) ? body.photos : [];
    const hasInline = rawList.some(
      (v) =>
        typeof v === 'string' &&
        (v.startsWith('data:') ||
          v.startsWith('blob:') ||
          v.startsWith('file:') ||
          v.startsWith('content:'))
    );
    if (hasInline) {
      throw new AppError(
        'Upload photos via multipart /profile/photos (do not send image data in JSON)',
        400
      );
    }
    const photos = normalizePhotos(body.photos);
    const count = countPhotos(photos);
    if (count > 0 && count < PROFILE_PHOTO_MIN) {
      throw new AppError(`At least ${PROFILE_PHOTO_MIN} profile photos are required`, 400);
    }
    patch.photos = photos;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'selectedServiceIds')) {
    const ids = normalizeStringArray(body.selectedServiceIds, 50);
    if (ids.length > 0) {
      const found = await CompanionCategory.findAll({
        where: { id: { [Op.in]: ids }, isActive: true },
        attributes: ['id'],
      });
      const valid = new Set(found.map((r) => r.id));
      const missing = ids.filter((id) => !valid.has(id));
      if (missing.length) {
        throw new AppError('One or more selected services are invalid', 400);
      }
    }
    patch.selectedServiceIds = ids;
  }

  // aboutMe goes through approval — never publish directly via profile update
  if (Object.prototype.hasOwnProperty.call(body, 'aboutMe')) {
    const trimmed = (() => {
      try {
        return assertBioAllowed(body.aboutMe);
      } catch (e) {
        throw new AppError(e.message, e.statusCode || 400);
      }
    })();
    if (!trimmed) {
      patch.pendingBio = null;
      if (!user.aboutMe) patch.bioStatus = BIO_STATUS.NONE;
    } else {
      patch.pendingBio = trimmed;
      patch.bioStatus = BIO_STATUS.PENDING;
    }
  }

  await user.update(patch);
  await user.reload({
    include: [{ model: City, as: 'city', attributes: ['id', 'name'] }],
  });
  return formatProfile(user);
}

/** Explicit bio submit for signup / about screen */
async function submitBio(userId, aboutMe) {
  let trimmed;
  try {
    trimmed = assertBioAllowed(aboutMe);
  } catch (e) {
    throw new AppError(e.message, e.statusCode || 400);
  }
  if (!trimmed) {
    throw new AppError('Bio text is required', 400);
  }

  const user = await User.findByPk(userId, {
    include: [{ model: City, as: 'city', attributes: ['id', 'name'] }],
  });
  if (!user) throw new AppError('User not found', 404);
  if (!user.isActive) throw new AppError('Account is deactivated', 403);

  await user.update({
    pendingBio: trimmed,
    bioStatus: BIO_STATUS.PENDING,
  });
  await user.reload({
    include: [{ model: City, as: 'city', attributes: ['id', 'name'] }],
  });
  return formatProfile(user);
}

/**
 * Replace gallery via multipart files (same as compameet-backend).
 * Field name: photos (2–5 files).
 */
async function replacePhotos(userId, files = []) {
  if (!files.length || files.length < PROFILE_PHOTO_MIN) {
    throw new AppError(`At least ${PROFILE_PHOTO_MIN} photos are required`, 400);
  }
  if (files.length > PROFILE_PHOTO_SLOTS) {
    throw new AppError(`Maximum ${PROFILE_PHOTO_SLOTS} photos allowed`, 400);
  }

  const user = await User.findByPk(userId, {
    include: [{ model: City, as: 'city', attributes: ['id', 'name'] }],
  });
  if (!user) throw new AppError('User not found', 404);
  if (!user.isActive) throw new AppError('Account is deactivated', 403);

  const oldPhotos = normalizePhotos(user.photos).filter(Boolean);

  const saved = [];
  for (let i = 0; i < files.length; i += 1) {
    const relative = await storageService.saveProfilePicture(files[i], 'user');
    saved.push(relative);
  }

  const photos = Array.from({ length: PROFILE_PHOTO_SLOTS }, (_, i) => saved[i] || null);
  await user.update({ photos });
  await user.reload({
    include: [{ model: City, as: 'city', attributes: ['id', 'name'] }],
  });

  for (const old of oldPhotos) {
    if (!saved.includes(old)) {
      await storageService.deleteProfilePicture(old);
    }
  }

  return formatProfile(user);
}

/**
 * Upload / replace a single slot (0–4). Keeps other slots.
 */
async function uploadPhotoSlot(userId, file, index) {
  const slot = Number(index);
  if (!Number.isInteger(slot) || slot < 0 || slot >= PROFILE_PHOTO_SLOTS) {
    throw new AppError(`index must be 0–${PROFILE_PHOTO_SLOTS - 1}`, 400);
  }
  if (!file) throw new AppError('photo file is required', 400);

  const user = await User.findByPk(userId, {
    include: [{ model: City, as: 'city', attributes: ['id', 'name'] }],
  });
  if (!user) throw new AppError('User not found', 404);
  if (!user.isActive) throw new AppError('Account is deactivated', 403);

  const photos = normalizePhotos(user.photos);
  const previous = photos[slot];
  const relative = await storageService.saveProfilePicture(file, 'user');
  photos[slot] = relative;

  await user.update({ photos });
  await user.reload({
    include: [{ model: City, as: 'city', attributes: ['id', 'name'] }],
  });

  if (previous && previous !== relative) {
    await storageService.deleteProfilePicture(previous);
  }

  return formatProfile(user);
}

async function clearPhotoSlot(userId, index) {
  const slot = Number(index);
  if (!Number.isInteger(slot) || slot < 0 || slot >= PROFILE_PHOTO_SLOTS) {
    throw new AppError(`index must be 0–${PROFILE_PHOTO_SLOTS - 1}`, 400);
  }

  const user = await User.findByPk(userId, {
    include: [{ model: City, as: 'city', attributes: ['id', 'name'] }],
  });
  if (!user) throw new AppError('User not found', 404);

  const photos = normalizePhotos(user.photos);
  const previous = photos[slot];
  if (!previous) return formatProfile(user);

  const nextCount = countPhotos(photos) - 1;
  if (nextCount > 0 && nextCount < PROFILE_PHOTO_MIN) {
    throw new AppError(`Keep at least ${PROFILE_PHOTO_MIN} photos on your profile`, 400);
  }

  photos[slot] = null;
  await user.update({ photos });
  await user.reload({
    include: [{ model: City, as: 'city', attributes: ['id', 'name'] }],
  });
  await storageService.deleteProfilePicture(previous);
  return formatProfile(user);
}

/**
 * Persist signup wizard progress.
 * Body: { step: 2-5 } and/or { completed: true }
 */
async function updateOnboarding(userId, body = {}) {
  const user = await User.findByPk(userId, {
    include: [{ model: City, as: 'city', attributes: ['id', 'name'] }],
  });
  if (!user) throw new AppError('User not found', 404);
  if (!user.isActive) throw new AppError('Account is deactivated', 403);

  if (body.completed === true) {
    await user.update({
      onboardingCompleted: true,
      onboardingStep: 0,
    });
  } else if (body.step != null) {
    const step = Number(body.step);
    if (![2, 3, 4, 5].includes(step)) {
      throw new AppError('onboarding step must be 2, 3, 4, or 5', 400);
    }
    await user.update({
      onboardingStep: step,
      onboardingCompleted: false,
    });
  } else {
    throw new AppError('Provide step or completed: true', 400);
  }

  await user.reload({
    include: [{ model: City, as: 'city', attributes: ['id', 'name'] }],
  });
  return formatProfile(user);
}

function parseCoord(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

async function updateCurrentLocation(userId, body = {}, opts = {}) {
  const lat = parseCoord(body.latitude ?? body.lat);
  const lng = parseCoord(body.longitude ?? body.lng);
  if (lat == null || lng == null) {
    throw new AppError('latitude and longitude are required', 400);
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new AppError('Invalid coordinates', 400);
  }

  const user = await User.findByPk(userId);
  if (!user) throw new AppError('User not found', 404);

  const now = new Date();
  user.latitude = lat;
  user.longitude = lng;
  user.locationUpdatedAt = now;
  await user.save({ fields: ['latitude', 'longitude', 'locationUpdatedAt'] });

  const result = {
    latitude: user.latitude,
    longitude: user.longitude,
    locationUpdatedAt: user.locationUpdatedAt,
  };

  try {
    const { emitLocationLive } = require('../../../socket/io');
    emitLocationLive(userId, {
      latitude: result.latitude,
      longitude: result.longitude,
      locationUpdatedAt: result.locationUpdatedAt,
      at: now.toISOString(),
      accuracy: body.accuracy != null ? Number(body.accuracy) : null,
      source: opts.source || 'rest',
    });
  } catch {
    // socket optional at boot
  }

  return result;
}

module.exports = {
  PROFILE_PHOTO_SLOTS,
  PROFILE_PHOTO_MIN,
  getProfile,
  updateProfile,
  submitBio,
  updateOnboarding,
  replacePhotos,
  uploadPhotoSlot,
  clearPhotoSlot,
  updateCurrentLocation,
  formatProfile,
  resolveOnboardingStep,
  defaultAvailability,
  normalizePhotos,
  countPhotos,
};
