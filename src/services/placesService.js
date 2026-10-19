'use strict';

const AppError = require('../utils/AppError');
const getApiKey = () => String(process.env.GOOGLE_MAPS_API_KEY || '').trim();

const isConfigured = () => Boolean(getApiKey());

/** Strip `places/` resource prefix if Google returns a full name. */
const normalizePlaceId = (placeId) =>
  String(placeId || '')
    .trim()
    .replace(/^places\//, '');

/**
 * Address / private dwelling types — not allowed as Compameet meeting points.
 * Users must pick a public venue (cafe, mall, park, restaurant, etc.).
 */
const PRIVATE_PLACE_TYPES = new Set([
  'street_address',
  'premise',
  'subpremise',
  'route',
  'intersection',
  'plus_code',
  'neighborhood',
  'sublocality',
  'sublocality_level_1',
  'sublocality_level_2',
  'sublocality_level_3',
  'sublocality_level_4',
  'sublocality_level_5',
  'administrative_area_level_1',
  'administrative_area_level_2',
  'administrative_area_level_3',
  'administrative_area_level_4',
  'administrative_area_level_5',
  'locality',
  'political',
  'country',
  'postal_code',
  'postal_code_prefix',
  'postal_town',
  'colloquial_area',
  'floor',
  'room',
  'geocode',
  'housing_complex',
  'apartment_complex',
  'apartment_building',
  'condominium_complex',
  'residential',
]);

/** Always block — even when Google also tags establishment / POI */
const ALWAYS_PRIVATE_TYPES = new Set([
  'street_address',
  'premise',
  'subpremise',
  'housing_complex',
  'apartment_complex',
  'apartment_building',
  'condominium_complex',
  'residential',
  'route',
  'plus_code',
  // Hotels / OYO / rooms = private meet, not public meetup venues
  'lodging',
  'hotel',
  'motel',
  'guest_house',
  'hostel',
  'resort_hotel',
  'extended_stay_hotel',
  'bed_and_breakfast',
  'cottage',
  'campground',
  'rv_park',
  'private_guest_room',
]);

const PUBLIC_HINT_TYPES = new Set([
  'establishment',
  'point_of_interest',
  'food',
  'store',
  'restaurant',
  'cafe',
  'bar',
  'shopping_mall',
  'park',
  'tourist_attraction',
  'museum',
  'movie_theater',
  'gym',
  'library',
  'university',
  'school',
  'hospital',
  'supermarket',
  'convenience_store',
  'bakery',
  'meal_takeaway',
  'night_club',
  'bowling_alley',
  'amusement_park',
  'aquarium',
  'zoo',
  'stadium',
  'church',
  'hindu_temple',
  'mosque',
  'synagogue',
  'place_of_worship',
]);

/** Brand / name hints for private stay venues (hotel, OYO, etc.) */
const PRIVATE_NAME_RE =
  /\b(oyo|townhouse\s+by\s+oyo|fabhotel|treebo|hotel\s+o\b|collection\s+o|spot\s+on|hotel|motel|hostel|resort|guest\s*house|guest\s*house|lodge|inn|pg\b|paying\s+guest|service\s+apartment|serviced\s+apartment)\b/i;

const OTHER_STATE_RE =
  /\b(rajasthan|maharashtra|gujarat|uttar\s+pradesh|bihar|punjab|haryana|karnataka|tamil\s+nadu|kerala|telangana|andhra\s+pradesh|west\s+bengal|odisha|assam|goa|chhattisgarh|jharkhand|uttarakhand|himachal\s+pradesh|delhi|new\s+delhi)\b/i;

const normalizeTypes = (types, primaryType) => {
  const list = [...(Array.isArray(types) ? types : []), primaryType]
    .filter(Boolean)
    .map((t) => String(t).trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(list)];
};

/**
 * City must appear in the ADDRESS (secondary line), not only in the place name
 * (e.g. "Hotel Indore Palace" in Rajasthan must not match Indore).
 */
const isInSelectedCity = (item, cityName) => {
  const city = String(cityName || '')
    .trim()
    .toLowerCase();
  if (!city) return false;

  const address = String(item.secondaryText || item.description || '')
    .trim()
    .toLowerCase();
  if (!address) return false;

  const cityInAddress =
    address.includes(`, ${city},`) ||
    address.includes(`, ${city} `) ||
    address.endsWith(`, ${city}`) ||
    address.includes(`${city}, madhya pradesh`) ||
    address.startsWith(`${city},`);

  if (!cityInAddress) return false;

  // Compameet cities are in MP — drop rows that clearly name another state
  if (OTHER_STATE_RE.test(address) && !/\bmadhya\s+pradesh\b/i.test(address)) {
    return false;
  }

  return true;
};

/**
 * True when the place looks like a private address / hotel / room, not a public venue.
 */
const isPrivatePlaceTypes = (types, primaryType, nameHints = '') => {
  const list = normalizeTypes(types, primaryType);
  if (PRIVATE_NAME_RE.test(String(nameHints || ''))) return true;
  if (!list.length) return false;

  // Housing / hotels / street addresses stay private even if tagged establishment
  if (list.some((t) => ALWAYS_PRIVATE_TYPES.has(t))) return true;

  const primary = primaryType ? String(primaryType).trim().toLowerCase() : '';
  if (primary && PRIVATE_PLACE_TYPES.has(primary) && !PUBLIC_HINT_TYPES.has(primary)) {
    return true;
  }
  if (primary && ALWAYS_PRIVATE_TYPES.has(primary)) return true;

  const hasPublicHint = list.some((t) => PUBLIC_HINT_TYPES.has(t));
  const hasPrivateAddress = list.some((t) => PRIVATE_PLACE_TYPES.has(t));

  if (hasPrivateAddress && !hasPublicHint) return true;
  if (list.every((t) => PRIVATE_PLACE_TYPES.has(t))) return true;

  return false;
};

const assertPublicPlace = (types, primaryType, nameHints = '') => {
  if (isPrivatePlaceTypes(types, primaryType, nameHints)) {
    throw new AppError(
      'Only public places are allowed (cafe, mall, park, restaurant). Hotels, OYO, and private homes cannot be used.',
      400
    );
  }
};

/**
 * Places API (New) fetch helper — key stays server-side only.
 * @see https://developers.google.com/maps/documentation/places/web-service/op-overview
 */
const placesNewFetch = async (url, { method = 'GET', body, fieldMask } = {}) => {
  const key = getApiKey();
  if (!key) {
    throw new AppError('Google Places is not configured. Set GOOGLE_MAPS_API_KEY.', 503);
  }

  const headers = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': key,
  };
  if (fieldMask) {
    headers['X-Goog-FieldMask'] = fieldMask;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok || data?.error) {
    const msg =
      data?.error?.message ||
      data?.error_message ||
      `Places API (New) request failed (${res.status})`;
    throw new AppError(msg, res.status >= 400 && res.status < 600 ? 502 : 502);
  }

  return data || {};
};

/**
 * Geocode a free-text address/city to lat/lng.
 * Uses Geocoding API (not Places Legacy). Result is used ephemerally for bias / booking only.
 */
const geocode = async (address) => {
  const key = getApiKey();
  if (!key) return null;
  const q = String(address || '').trim();
  if (!q) return null;

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', q);
  url.searchParams.set('key', key);
  url.searchParams.set('region', 'in');

  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.status !== 'OK' || !data.results?.[0]) return null;

  const r = data.results[0];
  const loc = r.geometry?.location || {};
  return {
    address: r.formatted_address || q,
    latitude: loc.lat ?? null,
    longitude: loc.lng ?? null,
    placeId: r.place_id || null,
  };
};

/**
 * Autocomplete — Places API (New), restricted to selected city + public venues.
 */
const autocomplete = async (input, { sessionToken, city, cityId } = {}) => {
  if (!isConfigured()) {
    throw new AppError('Google Places is not configured. Set GOOGLE_MAPS_API_KEY.', 503);
  }

  const q = String(input || '').trim();
  if (q.length < 2) return { items: [] };

  let cityName = String(city || '').trim();
  let stateName = '';
  if (cityId) {
    try {
      const { City } = require('../models');
      const row = await City.findByPk(cityId, { attributes: ['id', 'name', 'state'] });
      if (!cityName) cityName = row?.name ? String(row.name).trim() : '';
      stateName = row?.state ? String(row.state).trim() : '';
    } catch {
      stateName = '';
    }
  }

  if (!cityName) {
    throw new AppError('Select a booking city before searching places', 400);
  }

  const body = {
    input: `${q} ${cityName}`,
    includedRegionCodes: ['in'],
  };
  const token = String(sessionToken || '').trim();
  if (token) body.sessionToken = token;

  // HARD restrict to selected city (soft locationBias was returning other states)
  const geo =
    (stateName ? await geocode(`${cityName}, ${stateName}, India`) : null) ||
    (await geocode(`${cityName}, India`));
  if (geo?.latitude != null && geo?.longitude != null) {
    body.locationRestriction = {
      circle: {
        center: {
          latitude: geo.latitude,
          longitude: geo.longitude,
        },
        radius: 40000.0,
      },
    };
  }

  const data = await placesNewFetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    fieldMask:
      'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.types',
    body,
  });

  const items = (data.suggestions || [])
    .map((s) => s.placePrediction)
    .filter(Boolean)
    .map((p) => {
      const placeId = normalizePlaceId(p.placeId || p.place);
      const description = p.text?.text || '';
      const mainText = p.structuredFormat?.mainText?.text || description;
      const secondaryText = p.structuredFormat?.secondaryText?.text || null;
      const types = Array.isArray(p.types) ? p.types : [];
      return {
        placeId,
        description,
        mainText,
        secondaryText,
        types,
      };
    })
    .filter((item) => item.placeId)
    .filter((item) => isInSelectedCity(item, cityName))
    .filter(
      (item) =>
        !isPrivatePlaceTypes(
          item.types,
          null,
          `${item.mainText || ''} ${item.description || ''}`
        )
    );

  return {
    items,
    city: cityName,
    publicPlacesOnly: true,
  };
};

/**
 * Place Details — Places API (New)
 * Always fetched live from Google (no permanent Places response cache).
 * Rejects private / residential addresses.
 */
const placeDetails = async (placeId, { sessionToken } = {}) => {
  if (!isConfigured()) {
    throw new AppError('Google Places is not configured. Set GOOGLE_MAPS_API_KEY.', 503);
  }

  const id = normalizePlaceId(placeId);
  if (!id) throw new AppError('placeId is required', 400);

  void sessionToken;

  const data = await placesNewFetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`,
    {
      method: 'GET',
      fieldMask: 'id,displayName,formattedAddress,location,types,primaryType',
    }
  );

  const types = Array.isArray(data.types) ? data.types : [];
  const primaryType = data.primaryType || null;
  const nameHints = `${data.displayName?.text || ''} ${data.formattedAddress || ''}`;
  assertPublicPlace(types, primaryType, nameHints);

  const googlePlaceId = normalizePlaceId(data.id) || id;
  const latitude = data.location?.latitude ?? null;
  const longitude = data.location?.longitude ?? null;

  return {
    placeId: googlePlaceId,
    name: data.displayName?.text || null,
    address: data.formattedAddress || data.displayName?.text || null,
    latitude,
    longitude,
    googlePlaceId,
    primaryType,
    types,
    publicPlace: true,
    location: {
      latitude,
      longitude,
    },
  };
};

/**
 * Map marker payload only — always live Place Details (New).
 */
const mapMarkerForPlaceId = async (placeId) => {
  const details = await placeDetails(placeId);
  if (details.location?.latitude == null || details.location?.longitude == null) {
    throw new AppError('Place location is unavailable for map marker', 502);
  }
  return {
    googlePlaceId: details.googlePlaceId,
    location: {
      latitude: details.location.latitude,
      longitude: details.location.longitude,
    },
  };
};

/**
 * Best match for a free-text query via Places API (New) Text Search.
 * Works with the same key as autocomplete (Geocoding API need not be enabled).
 */
const findPlaceLocation = async (query) => {
  const textQuery = String(query || '').trim();
  if (!textQuery) return null;
  const data = await placesNewFetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    body: { textQuery, regionCode: 'in', languageCode: 'en', pageSize: 1 },
    fieldMask: 'places.id,places.displayName,places.formattedAddress,places.location,places.types',
  });
  const p = data.places?.[0];
  if (!p?.location) return null;
  return {
    name: p.displayName?.text || textQuery,
    address: p.formattedAddress || null,
    latitude: p.location.latitude,
    longitude: p.location.longitude,
    placeId: p.id || null,
    types: p.types || [],
  };
};

module.exports = {
  isConfigured,
  autocomplete,
  placeDetails,
  mapMarkerForPlaceId,
  geocode,
  findPlaceLocation,
  isPrivatePlaceTypes,
  assertPublicPlace,
};
