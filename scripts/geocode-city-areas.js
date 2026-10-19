/**
 * Builds src/seeders/data/city-areas.json from src/seeders/data/city-area-names.json
 * by looking up each area on Google Places (New) Text Search.
 *
 * Usage: node scripts/geocode-city-areas.js [--refresh | --retry]
 * Already-resolved cities are skipped unless --refresh is passed;
 * --retry re-runs only cities that hit rate limits / network errors.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'src', 'seeders', 'data');
const NAMES_FILE = path.join(DATA_DIR, 'city-area-names.json');
const OUT_FILE = path.join(DATA_DIR, 'city-areas.json');
const REJECT_FILE = path.join(DATA_DIR, 'city-areas-rejected.json');

const KEY = String(process.env.GOOGLE_MAPS_API_KEY || '').trim();
if (!KEY) {
  console.error('GOOGLE_MAPS_API_KEY is not set');
  process.exit(1);
}

const CONCURRENCY = 4;

async function searchText(body) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': KEY,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.types',
      },
      body: JSON.stringify({ regionCode: 'in', languageCode: 'en', pageSize: 1, ...body }),
    });
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || `HTTP ${res.status}`);
    return json.places?.[0] || null;
  }
  throw new Error('Google Places rate limited');
}

function distanceKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Bigger cities (longer area lists) get a wider radius. */
const radiusKmFor = (count) => (count >= 20 ? 35 : count >= 14 ? 25 : 18);

const round = (n) => Math.round(n * 1e5) / 1e5;

async function resolveCity(key, names) {
  const [city, state] = key.split('|');
  const center = await searchText({ textQuery: `${city}, ${state}, India` });
  if (!center?.location) return { areas: [], rejected: names.map((name) => ({ name, reason: 'city not found' })) };

  const radiusKm = radiusKmFor(names.length);
  const areas = [];
  const rejected = [];
  for (const name of names) {
    let place;
    try {
      place = await searchText({
        textQuery: `${name}, ${city}, ${state}`,
        locationBias: { circle: { center: center.location, radius: Math.min(50000, radiusKm * 1000) } },
      });
    } catch (err) {
      rejected.push({ name, reason: err.message });
      continue;
    }
    if (!place?.location) {
      rejected.push({ name, reason: 'no result' });
      continue;
    }
    const km = distanceKm(center.location, place.location);
    const label = place.displayName?.text || '';
    const types = place.types || [];
    if (km > radiusKm) {
      rejected.push({ name, reason: `${km.toFixed(1)} km away`, got: label });
      continue;
    }
    const isCityFallback =
      label.toLowerCase() === city.toLowerCase() && types.some((t) => t === 'locality' || t.startsWith('administrative_area'));
    if (isCityFallback) {
      rejected.push({ name, reason: 'resolved to the city itself' });
      continue;
    }
    const dup = areas.find((a) => distanceKm(a, place.location) < 0.05);
    if (dup) {
      rejected.push({ name, reason: `same point as ${dup.name}` });
      continue;
    }
    areas.push({ name, latitude: round(place.location.latitude), longitude: round(place.location.longitude) });
  }
  return { areas, rejected };
}

async function main() {
  const refresh = process.argv.includes('--refresh');
  const names = JSON.parse(fs.readFileSync(NAMES_FILE, 'utf8'));
  const out = !refresh && fs.existsSync(OUT_FILE) ? JSON.parse(fs.readFileSync(OUT_FILE, 'utf8')) : {};
  const rejects = !refresh && fs.existsSync(REJECT_FILE) ? JSON.parse(fs.readFileSync(REJECT_FILE, 'utf8')) : {};

  const retry = process.argv.includes('--retry');
  const hadTransientError = (key) => (rejects[key] || []).some((r) => /rate limited|fetch failed/i.test(r.reason));
  const queue = Object.keys(names).filter((key) => refresh || !out[key] || (retry && hadTransientError(key)));
  console.log(`Resolving ${queue.length} cities…`);

  const save = () => {
    const sorted = (obj) => Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]));
    fs.writeFileSync(OUT_FILE, `${JSON.stringify(sorted(out), null, 2)}\n`);
    fs.writeFileSync(REJECT_FILE, `${JSON.stringify(sorted(rejects), null, 2)}\n`);
  };

  let done = 0;
  const worker = async () => {
    while (queue.length) {
      const key = queue.shift();
      try {
        const { areas, rejected } = await resolveCity(key, names[key]);
        out[key] = areas;
        if (rejected.length) rejects[key] = rejected;
        else delete rejects[key];
        done += 1;
        console.log(`[${done}] ${key}: ${areas.length} ok, ${rejected.length} rejected`);
      } catch (err) {
        console.error(`${key}: ${err.message}`);
      }
      if (done % 10 === 0) save();
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  save();
  const total = Object.values(out).reduce((n, list) => n + list.length, 0);
  console.log(`Done. ${Object.keys(out).length} cities, ${total} areas → ${path.relative(process.cwd(), OUT_FILE)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
