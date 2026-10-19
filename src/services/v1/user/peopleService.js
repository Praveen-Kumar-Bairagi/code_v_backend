const { Op } = require('sequelize');
const { User, City, CityArea } = require('../../../models');
const AppError = require('../../../utils/AppError');
const storageService = require('../../storageService');
const likeService = require('./likeService');
const { isActiveCreator, activeCreatorWhere } = require('./creatorProfileService');
const { settingsOf } = require('./settingsService');

/** Lean fields for grid browse */
const listAttributes = [
  'id',
  'firstName',
  'lastName',
  'gender',
  'dateOfBirth',
  'cityId',
  'hasUserProfile',
  'hasCompanionProfile',
  'isCreator',
  'creatorHandle',
  'creatorExpiresAt',
  'photos',
  'interests',
  'photoVerified',
  'kycVerified',
  'hideAge',
  'latitude',
  'longitude',
  'settings',
];

/** Full public profile for discover feed / detail */
const detailAttributes = [
  ...listAttributes,
  'aboutMe',
  'bioStatus',
  'education',
  'profession',
  'religion',
  'drinking',
  'smoking',
  'eating',
  'relationshipStatus',
  'lookingFor',
  'selectedServiceIds',
  'availability',
  'facebookVerified',
  'mobileNumber',
];

function normalizePhotos(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(Boolean).map((p) => String(p));
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const aLat = Number(lat1);
  const aLon = Number(lon1);
  const bLat = Number(lat2);
  const bLon = Number(lon2);
  if (![aLat, aLon, bLat, bLon].every((n) => Number.isFinite(n))) return null;
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function formatPerson(user, { full = false, viewerLat = null, viewerLng = null } = {}) {
  const json = user.toJSON ? user.toJSON() : user;
  const photos = normalizePhotos(json.photos)
    .map((p) => storageService.getPublicUrl(p))
    .filter(Boolean);

  const prefs = settingsOf(json);
  const latitude = json.latitude != null ? Number(json.latitude) : null;
  const longitude = json.longitude != null ? Number(json.longitude) : null;
  const distanceKm = haversineKm(viewerLat, viewerLng, latitude, longitude);

  const base = {
    id: json.id,
    firstName: json.firstName,
    lastName: json.lastName,
    fullName: [json.firstName, json.lastName].filter(Boolean).join(' ').trim(),
    gender: json.gender,
    dateOfBirth: json.hideAge ? null : json.dateOfBirth,
    hideAge: !!json.hideAge,
    cityId: json.cityId,
    cityName: json.city ? json.city.name : null,
    hasUserProfile: json.hasUserProfile,
    hasCompanionProfile: json.hasCompanionProfile,
    isCreator: isActiveCreator(json),
    creatorHandle: isActiveCreator(json) ? json.creatorHandle || null : null,
    photos,
    photoUrl: photos[0] || null,
    interests: Array.isArray(json.interests) ? json.interests.filter(Boolean) : [],
    photoVerified: !!json.photoVerified,
    kycVerified: !!json.kycVerified,
    mobileVerified: !!json.mobileNumber,
    latitude,
    longitude,
    distanceKm,
    paused: prefs.pauseProfile,
  };
  if (prefs.hideDistance) {
    base.latitude = null;
    base.longitude = null;
    base.distanceKm = null;
    base.hideDistance = true;
  }

  if (!full) return base;

  return {
    ...base,
    aboutMe: json.bioStatus === 'approved' ? json.aboutMe || '' : '',
    education: prefs.hideWork ? null : json.education || null,
    profession: prefs.hideWork ? null : json.profession || null,
    religion: json.religion || null,
    drinking: prefs.hideLifestyle ? null : json.drinking || null,
    smoking: prefs.hideLifestyle ? null : json.smoking || null,
    eating: prefs.hideLifestyle ? null : json.eating || null,
    relationshipStatus: json.relationshipStatus || null,
    lookingFor: json.lookingFor || null,
    selectedServiceIds: Array.isArray(json.selectedServiceIds)
      ? json.selectedServiceIds
      : [],
    availability:
      json.availability && typeof json.availability === 'object' ? json.availability : {},
    facebookVerified: !!json.facebookVerified,
  };
}

function parseViewerCoords(opts = {}) {
  const lat = opts.latitude != null ? Number(opts.latitude) : null;
  const lng = opts.longitude != null ? Number(opts.longitude) : null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { viewerLat: null, viewerLng: null };
  }
  return { viewerLat: lat, viewerLng: lng };
}

const NEARBY_KM = 25;
const MIN_AGE = 18;
const MAX_AGE = 80;
const DEFAULT_RADIUS_KM = 100;

function isTrue(v) {
  return v === true || v === 'true' || v === '1';
}

/** Average of the city's geocoded areas, or null when none are geocoded. */
async function cityCenter(cityId) {
  if (!cityId) return null;
  const areas = await CityArea.findAll({
    where: { cityId, latitude: { [Op.ne]: null }, longitude: { [Op.ne]: null } },
    attributes: ['latitude', 'longitude'],
  });
  const pts = areas
    .map((a) => [Number(a.latitude), Number(a.longitude)])
    .filter(([la, ln]) => Number.isFinite(la) && Number.isFinite(ln));
  if (!pts.length) return null;
  return {
    lat: pts.reduce((s, p) => s + p[0], 0) / pts.length,
    lng: pts.reduce((s, p) => s + p[1], 0) / pts.length,
  };
}

/** DATEONLY string for "today minus N years" (local server date). */
function yearsAgo(years, extraDays = 0) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() + extraDays);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseAge(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return null;
  return Math.min(MAX_AGE, Math.max(MIN_AGE, n));
}

/** male → female, female → male, other → everyone. */
function defaultDiscoverGender(viewerGender) {
  if (viewerGender === 'male') return 'female';
  if (viewerGender === 'female') return 'male';
  return 'all';
}

/** Nearby (≤ NEARBY_KM, by distance) → same city → other cities (by distance, unknown last). */
function discoverRank(person, viewerCityId) {
  if (person.distanceKm != null && person.distanceKm <= NEARBY_KM) return 0;
  if (viewerCityId && String(person.cityId) === String(viewerCityId)) return 1;
  return 2;
}

function byDistance(a, b) {
  if (a.distanceKm == null && b.distanceKm == null) return 0;
  if (a.distanceKm == null) return 1;
  if (b.distanceKm == null) return -1;
  return a.distanceKm - b.distanceKm;
}

async function listPeople(
  currentUserId,
  {
    cityId,
    creatorsOnly,
    full,
    latitude,
    longitude,
    search,
    discover,
    gender,
    minAge,
    maxAge,
    radiusKm,
    photosOnly,
    otherCities,
    sort,
  } = {}
) {
  const onlyCreators = isTrue(creatorsOnly);
  // Creators list shows everyone except blocked users, even if skipped or connected.
  const excluded = onlyCreators
    ? await likeService.getBlockedUserIds(currentUserId)
    : await likeService.getExcludedUserIds(currentUserId);
  const isDiscover = isTrue(discover);
  const where = {
    id: {
      [Op.and]: [
        { [Op.ne]: currentUserId },
        ...(excluded.length ? [{ [Op.notIn]: excluded }] : []),
      ],
    },
    isActive: true,
    ...(onlyCreators ? activeCreatorWhere() : {}),
  };
  if (cityId && !isDiscover) {
    where.cityId = cityId;
  }
  const handleQuery = String(search || '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
  if (onlyCreators && handleQuery) {
    where.creatorHandle = { [Op.like]: `%${handleQuery.replace(/[%_\\]/g, '\\$&')}%` };
  }

  const { viewerLat, viewerLng } = parseViewerCoords({ latitude, longitude });
  const me = await User.findByPk(currentUserId, {
    attributes: ['latitude', 'longitude', 'gender', 'cityId'],
  });

  // Prefer live viewer coords; else fall back to viewer's last stored location
  let lat = viewerLat;
  let lng = viewerLng;
  if ((lat == null || lng == null) && me?.latitude != null && me?.longitude != null) {
    lat = Number(me.latitude);
    lng = Number(me.longitude);
  }

  // Discover always uses the default (opposite) gender; it is not user-selectable.
  const genderParam = String(gender || '').toLowerCase();
  const genderFilter = isDiscover
    ? defaultDiscoverGender(me?.gender)
    : ['male', 'female', 'other', 'all'].includes(genderParam)
      ? genderParam
      : 'all';
  if (genderFilter !== 'all') where.gender = genderFilter;

  let lo = parseAge(minAge);
  let hi = parseAge(maxAge);
  if (lo != null && hi != null && lo > hi) [lo, hi] = [hi, lo];
  if (lo != null || hi != null) {
    // age ≥ lo ⇔ born on/before today−lo years; age ≤ hi ⇔ born after today−(hi+1) years
    where.dateOfBirth = {
      ...(lo != null ? { [Op.lte]: yearsAgo(lo) } : {}),
      ...(hi != null ? { [Op.gt]: yearsAgo(hi + 1) } : {}),
    };
  }

  const users = await User.findAll({
    where,
    attributes: full ? detailAttributes : listAttributes,
    include: [{ model: City, as: 'city', attributes: ['id', 'name'] }],
    order: [
      ['firstName', 'ASC'],
      ['lastName', 'ASC'],
    ],
  });

  let people = users
    .map((u) => formatPerson(u, { full: Boolean(full), viewerLat: lat, viewerLng: lng }))
    .filter((p) => !p.paused);
  if (isDiscover) {
    if (isTrue(photosOnly)) people = people.filter((p) => p.photos.length > 0);

    const prefCityId = cityId || me?.cityId || null;
    const radius = Math.min(500, Math.max(10, Number(radiusKm) || DEFAULT_RADIUS_KM));
    let center = await cityCenter(prefCityId);
    if (!center && lat != null && String(prefCityId) === String(me?.cityId)) {
      center = { lat, lng };
    }
    const inPreference = (p) => {
      if (prefCityId && String(p.cityId) === String(prefCityId)) return true;
      if (!center) return !prefCityId;
      const d = haversineKm(center.lat, center.lng, p.latitude, p.longitude);
      return d != null && d <= radius;
    };

    const rank = (a, b) => {
      const ra = discoverRank(a, prefCityId);
      const rb = discoverRank(b, prefCityId);
      return ra !== rb ? ra - rb : byDistance(a, b);
    };
    const matches = people.filter(inPreference).sort(rank);
    const others = isTrue(otherCities)
      ? people
          .filter((p) => !inPreference(p))
          .sort(byDistance)
          .map((p) => ({ ...p, outsidePreference: true }))
      : [];
    people = [...matches, ...others];
  } else if (sort === 'city') {
    people.sort((a, b) => String(a.cityName || '').localeCompare(String(b.cityName || '')));
  } else if (sort === 'distance' || (!sort && onlyCreators && lat != null && lng != null)) {
    // Nearby first; unknown location last
    people.sort(byDistance);
  }
  return people;
}

async function getPersonById(currentUserId, personId, { latitude, longitude } = {}) {
  if (String(personId) === String(currentUserId)) {
    throw new AppError('Cannot view your own profile via people endpoint', 400);
  }

  const { viewerLat, viewerLng } = parseViewerCoords({ latitude, longitude });
  let lat = viewerLat;
  let lng = viewerLng;
  if (lat == null || lng == null) {
    const me = await User.findByPk(currentUserId, {
      attributes: ['latitude', 'longitude'],
    });
    if (me?.latitude != null && me?.longitude != null) {
      lat = Number(me.latitude);
      lng = Number(me.longitude);
    }
  }

  const user = await User.findOne({
    where: { id: personId, isActive: true },
    attributes: detailAttributes,
    include: [{ model: City, as: 'city', attributes: ['id', 'name'] }],
  });

  if (!user || (await likeService.isBlockedBetween(currentUserId, personId))) {
    throw new AppError('Person not found', 404);
  }

  const { findActivePlanOf, formatPlan } = require('./planService');
  const [plan, viewer] = await Promise.all([
    findActivePlanOf(user.id),
    User.findByPk(currentUserId, { attributes: ['gender'] }),
  ]);
  const planOpen =
    plan && (plan.preferredGender === 'all' || plan.preferredGender === viewer?.gender);

  return {
    ...formatPerson(user, { full: true, viewerLat: lat, viewerLng: lng }),
    activePlan: planOpen ? formatPlan(plan) : null,
  };
}

module.exports = {
  listPeople,
  getPersonById,
};
