import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMockBathrooms } from './mockData';
import { getDistanceMeters, formatDistance, computeRating } from '../utils/geo';

export { getMockBathrooms };

const CACHE_KEY = '@poopfinder_bathroom_cache';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CACHE_RADIUS_DEG = 0.05;        // ~5 km — invalidate if user moved

// Two bathrooms within this distance (meters) are considered the same place
const DEDUP_THRESHOLD_M = 60;

// ─── Cache helpers ────────────────────────────────────────────────────────────

// Returns cached bathrooms only if fresh (within TTL) and nearby.
export async function loadCachedBathrooms(latitude, longitude) {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { bathrooms, lat, lon, timestamp } = JSON.parse(raw);
    const expired = Date.now() - timestamp > CACHE_TTL_MS;
    const moved =
      Math.abs(lat - latitude) > CACHE_RADIUS_DEG ||
      Math.abs(lon - longitude) > CACHE_RADIUS_DEG;
    if (expired || moved) return null;
    return bathrooms?.length ? bathrooms : null;
  } catch {
    return null;
  }
}

// Returns whatever is in the cache regardless of age or distance.
// Used as a last resort before falling back to mock data.
export async function loadStaleCachedBathrooms() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { bathrooms } = JSON.parse(raw);
    return bathrooms?.length ? bathrooms : null;
  } catch {
    return null;
  }
}

async function saveCachedBathrooms(bathrooms, latitude, longitude) {
  try {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ bathrooms, lat: latitude, lon: longitude, timestamp: Date.now() })
    );
  } catch {}
}

// ─── Source priority for deduplication ───────────────────────────────────────
// Higher = preferred when two entries refer to the same physical toilet.
// City APIs have authoritative data; OSM is rich but crowdsourced; the rest fill gaps.
const SOURCE_PRIORITY = { city: 5, foursquare: 4, osm: 3, refuge: 2, wikidata: 1 };

// ─── 1. Overpass (OpenStreetMap) ──────────────────────────────────────────────

const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

async function fetchFromOverpass(latitude, longitude, radiusMeters) {
  // Scale Overpass server-side timeout with radius; cap at 60 s.
  const serverTimeout = Math.min(60, Math.ceil(30 * (radiusMeters / 5000)));
  const query = `
    [out:json][timeout:${serverTimeout}];
    (
      nwr["amenity"="toilets"](around:${radiusMeters},${latitude},${longitude});
      nwr["amenity"="public_bath"](around:${radiusMeters},${latitude},${longitude});
      nwr["building"="toilets"](around:${radiusMeters},${latitude},${longitude});
    );
    out center;
  `;

  const clientTimeoutMs = (serverTimeout + 5) * 1000; // 5 s grace over server timeout
  let lastError;
  for (const url of OVERPASS_MIRRORS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), clientTimeoutMs);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data.elements) throw new Error('No elements in response');
      return data.elements.map((el) => parseOverpassElement(el, latitude, longitude)).filter(Boolean);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('All Overpass mirrors failed');
}

function parseOverpassElement(el, userLat, userLon) {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat == null || lon == null) return null;

  const tags = el.tags || {};
  const distance = getDistanceMeters(userLat, userLon, lat, lon);

  return {
    id: `osm_${el.id}`,
    source: 'osm',
    latitude: lat,
    longitude: lon,
    name: tags.name || tags['name:en'] || 'Public Restroom',
    fee: tags.fee === 'yes',
    accessible: tags.wheelchair === 'yes',
    changingTable: tags.changing_table === 'yes',
    openingHours: tags.opening_hours || null,
    unisex: tags.unisex === 'yes',
    male: tags.male !== 'no',
    female: tags.female !== 'no',
    description: tags.description || null,
    distance,
    distanceLabel: formatDistance(distance),
    rating: computeRating({ ...tags, name: tags.name || tags['name:en'] }),
  };
}

// ─── 2. Refuge Restrooms ──────────────────────────────────────────────────────

const REFUGE_BASE = 'https://www.refugerestrooms.org/api/v1/restrooms/by_location.json';

async function fetchFromRefuge(latitude, longitude, radiusMeters) {
  const radiusMiles = radiusMeters / 1609.344;
  const url = `${REFUGE_BASE}?lat=${latitude}&lng=${longitude}&radius=${radiusMiles.toFixed(2)}&per_page=50`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) throw new Error(`Refuge HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('Unexpected Refuge response shape');
    return data.map((r) => parseRefugeRestroom(r, latitude, longitude)).filter(Boolean);
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

function parseRefugeRestroom(r, userLat, userLon) {
  const lat = parseFloat(r.latitude);
  const lon = parseFloat(r.longitude);
  if (isNaN(lat) || isNaN(lon)) return null;

  const distance = getDistanceMeters(userLat, userLon, lat, lon);
  const addressParts = [r.street, r.city, r.state].filter(Boolean);

  return {
    id: `refuge_${r.id}`,
    source: 'refuge',
    latitude: lat,
    longitude: lon,
    name: r.name || 'Public Restroom',
    fee: false,
    accessible: r.accessible ?? false,
    changingTable: r.changing_table ?? false,
    openingHours: null,
    unisex: r.unisex ?? false,
    male: !r.unisex,
    female: !r.unisex,
    description: [r.comment, addressParts.join(', ')].filter(Boolean).join(' — ') || null,
    distance,
    distanceLabel: formatDistance(distance),
    rating: computeRating({
      wheelchair: r.accessible ? 'yes' : 'no',
      changing_table: r.changing_table ? 'yes' : 'no',
      fee: 'no',
      name: r.name,
    }),
  };
}

// ─── 3. Wikidata SPARQL ───────────────────────────────────────────────────────
// Catches facilities that are in Wikidata but not yet mapped in OSM.
// Q6649324 = public toilet; wikibase:around does geospatial radius queries.

const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';

async function fetchFromWikidata(latitude, longitude, radiusMeters) {
  const radiusKm = (radiusMeters / 1000).toFixed(2);
  // WKT Point format is (longitude latitude)
  const query = `
    SELECT ?item ?itemLabel ?lat ?lon ?accessible ?fee WHERE {
      SERVICE wikibase:around {
        ?item wdt:P625 ?location .
        bd:serviceParam wikibase:center "Point(${longitude} ${latitude})"^^geo:wktLiteral .
        bd:serviceParam wikibase:radius "${radiusKm}" .
      }
      ?item wdt:P31/wdt:P279* wd:Q6649324 .
      BIND(geof:latitude(?location)  AS ?lat)
      BIND(geof:longitude(?location) AS ?lon)
      OPTIONAL { ?item wdt:P2846 ?accessible . }
      OPTIONAL { ?item wdt:P2848 ?fee . }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr,de,es,ja" . }
    }
    LIMIT 50
  `;

  const url = `${WIKIDATA_SPARQL}?query=${encodeURIComponent(query)}&format=json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/sparql-results+json' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) throw new Error(`Wikidata HTTP ${response.status}`);
    const data = await response.json();
    const bindings = data?.results?.bindings;
    if (!Array.isArray(bindings)) throw new Error('Unexpected Wikidata response shape');
    return bindings.map((b) => parseWikidataBinding(b, latitude, longitude)).filter(Boolean);
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

function parseWikidataBinding(b, userLat, userLon) {
  const lat = parseFloat(b.lat?.value);
  const lon = parseFloat(b.lon?.value);
  if (isNaN(lat) || isNaN(lon)) return null;

  const qid = b.item?.value?.split('/').pop() ?? 'unknown';
  const distance = getDistanceMeters(userLat, userLon, lat, lon);
  const name = b.itemLabel?.value || 'Public Restroom';
  // Skip if Wikidata label is just the QID (no useful name)
  if (/^Q\d+$/.test(name)) return null;

  return {
    id: `wd_${qid}`,
    source: 'wikidata',
    latitude: lat,
    longitude: lon,
    name,
    fee: false,          // Wikidata fee property (P2848) rarely populated — default safe
    accessible: false,   // Wikidata accessible property (P2846) rarely populated
    changingTable: false,
    openingHours: null,
    unisex: false,
    male: true,
    female: true,
    description: `Wikidata: ${qid}`,
    distance,
    distanceLabel: formatDistance(distance),
    rating: computeRating({ fee: 'no', name }),
  };
}

// ─── 4. City-specific open data APIs ─────────────────────────────────────────
// Each city entry defines a bounding box and a fetcher function.
// More cities can be added here without touching fetchNearbyBathrooms.

const CITY_SOURCES = [
  {
    name: 'NYC Open Data',
    // Bounding box for New York City (all 5 boroughs)
    bounds: { minLat: 40.4, maxLat: 40.92, minLon: -74.26, maxLon: -73.68 },
    fetch: fetchFromNYC,
  },
];

function isWithinBounds(latitude, longitude, bounds) {
  return (
    latitude  >= bounds.minLat && latitude  <= bounds.maxLat &&
    longitude >= bounds.minLon && longitude <= bounds.maxLon
  );
}

// NYC Open Data — Public Restrooms dataset (Socrata SODA API, no key required)
const NYC_ENDPOINT = 'https://data.cityofnewyork.us/resource/i7jb-7jku.json';

async function fetchFromNYC(latitude, longitude, radiusMeters) {
  const url =
    `${NYC_ENDPOINT}` +
    `?$where=${encodeURIComponent(`within_circle(location,${latitude},${longitude},${radiusMeters})` )}` +
    `&$limit=100`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) throw new Error(`NYC Open Data HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('Unexpected NYC response shape');
    return data.map((r) => parseNYCRestroom(r, latitude, longitude)).filter(Boolean);
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

function parseNYCRestroom(r, userLat, userLon) {
  const lat = parseFloat(r.location?.latitude ?? r.latitude);
  const lon = parseFloat(r.location?.longitude ?? r.longitude);
  if (isNaN(lat) || isNaN(lon)) return null;

  const distance = getDistanceMeters(userLat, userLon, lat, lon);

  return {
    id: `nyc_${r.id ?? r.facilityname ?? `${lat}_${lon}`}`,
    source: 'city',
    latitude: lat,
    longitude: lon,
    name: r.facilityname || r.name || 'NYC Public Restroom',
    fee: false,
    accessible: r.accessible === 'Y' || r.ada_accessible === 'Y' || false,
    changingTable: r.baby_changing_station === 'Y' || false,
    openingHours: r.hours_of_operation || r.openinghours || null,
    unisex: false,
    male: true,
    female: true,
    description: [r.location_type, r.operator, r.additional_notes].filter(Boolean).join(' · ') || null,
    distance,
    distanceLabel: formatDistance(distance),
    rating: computeRating({
      wheelchair: r.accessible === 'Y' ? 'yes' : 'no',
      changing_table: r.baby_changing_station === 'Y' ? 'yes' : 'no',
      fee: 'no',
      name: r.facilityname || r.name,
    }),
  };
}

// ─── 5. Foursquare Places ─────────────────────────────────────────────────────

const FSQ_KEY = process.env.EXPO_PUBLIC_FOURSQUARE_API_KEY;
const FSQ_SEARCH = 'https://api.foursquare.com/v3/places/search';
const FSQ_TIPS   = 'https://api.foursquare.com/v3/places';

async function fetchFromFoursquare(latitude, longitude, radiusMeters) {
  if (!FSQ_KEY) throw new Error('Foursquare API key not set');

  const params = new URLSearchParams({
    ll: `${latitude},${longitude}`,
    radius: Math.round(radiusMeters),
    query: 'public restroom',
    limit: '50',
    fields: 'fsq_id,name,geocodes,location,rating',
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${FSQ_SEARCH}?${params}`, {
      headers: { Authorization: FSQ_KEY, Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Foursquare HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.results)) throw new Error('Unexpected Foursquare response shape');
    return data.results.map((p) => parseFoursquarePlace(p, latitude, longitude)).filter(Boolean);
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

function parseFoursquarePlace(place, userLat, userLon) {
  const lat = place.geocodes?.main?.latitude;
  const lon = place.geocodes?.main?.longitude;
  if (lat == null || lon == null) return null;

  const distance = getDistanceMeters(userLat, userLon, lat, lon);
  // Foursquare rates 0–10; normalise to 0–5
  const fsqRating = place.rating != null ? parseFloat((place.rating / 2).toFixed(1)) : null;

  return {
    id: `fsq_${place.fsq_id}`,
    fsq_id: place.fsq_id,
    source: 'foursquare',
    latitude: lat,
    longitude: lon,
    name: place.name || 'Public Restroom',
    fee: false,
    accessible: false,
    changingTable: false,
    openingHours: null,
    unisex: false,
    male: true,
    female: true,
    description: [place.location?.address, place.location?.locality].filter(Boolean).join(', ') || null,
    distance,
    distanceLabel: formatDistance(distance),
    rating: fsqRating ?? computeRating({}),
  };
}

// Fetch tips (reviews) for a single Foursquare venue — called from DetailScreen.
export async function fetchFoursquareTips(fsq_id) {
  if (!FSQ_KEY || !fsq_id) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(
      `${FSQ_TIPS}/${fsq_id}/tips?limit=10&fields=id,created_at,text,agree_count,disagree_count`,
      { headers: { Authorization: FSQ_KEY, Accept: 'application/json' }, signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return [];
    const tips = await res.json();
    return Array.isArray(tips)
      ? tips.map((t) => ({
          source: 'foursquare',
          text: t.text,
          createdAt: t.created_at,
          agreeCount: t.agree_count ?? 0,
          disagreeCount: t.disagree_count ?? 0,
        }))
      : [];
  } catch {
    clearTimeout(timer);
    return [];
  }
}

// ─── 6. OSM Notes ─────────────────────────────────────────────────────────────
// Community map notes near a location; filtered to bathroom-relevant content.

const OSM_NOTES = 'https://api.openstreetmap.org/api/0.6/notes.json';
const BATHROOM_KEYWORDS = ['toilet', 'restroom', 'bathroom', 'wc', 'loo', 'lavatory', 'washroom'];

function containsBathroomKeyword(text) {
  const lower = text.toLowerCase();
  return BATHROOM_KEYWORDS.some((kw) => lower.includes(kw));
}

// Exported so DetailScreen can call it for a specific bathroom location.
export async function fetchOSMNotesNear(latitude, longitude, radiusMeters = 300) {
  const delta = radiusMeters / 111000;
  const lonDelta = delta / Math.cos((latitude * Math.PI) / 180);
  const bbox = [
    (longitude - lonDelta).toFixed(6),
    (latitude  - delta).toFixed(6),
    (longitude + lonDelta).toFixed(6),
    (latitude  + delta).toFixed(6),
  ].join(',');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${OSM_NOTES}?bbox=${bbox}&limit=100&closed=7`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data.features)) return [];

    const reviews = [];
    for (const feature of data.features) {
      const comments = feature.properties?.comments ?? [];
      for (const c of comments) {
        if (c.text && containsBathroomKeyword(c.text)) {
          reviews.push({
            source: 'osm_note',
            text: c.text,
            createdAt: c.date ?? null,
          });
        }
      }
    }
    return reviews;
  } catch {
    clearTimeout(timer);
    return [];
  }
}

// ─── Deduplication ────────────────────────────────────────────────────────────
// Uses a spatial grid to avoid O(n²) distance checks.
// Each cell is ~110 m wide; we only compare candidates in the 3×3 neighbourhood.

const GRID_CELL_DEG = 0.001; // ≈110 m per cell

function cellKey(lat, lon) {
  return `${Math.round(lat / GRID_CELL_DEG)},${Math.round(lon / GRID_CELL_DEG)}`;
}

function deduplicateBathrooms(lists) {
  // _ratings is a temporary accumulator: [{source, rating}]
  const merged = [];
  const grid = {};

  for (const bathroom of lists.flat()) {
    const cLat = Math.round(bathroom.latitude  / GRID_CELL_DEG);
    const cLon = Math.round(bathroom.longitude / GRID_CELL_DEG);

    let duplicateIdx = -1;
    outer: for (let dl = -1; dl <= 1; dl++) {
      for (let dc = -1; dc <= 1; dc++) {
        const key = `${cLat + dl},${cLon + dc}`;
        const bucket = grid[key];
        if (!bucket) continue;
        for (const idx of bucket) {
          const existing = merged[idx];
          if (
            getDistanceMeters(
              existing.latitude, existing.longitude,
              bathroom.latitude, bathroom.longitude
            ) < DEDUP_THRESHOLD_M
          ) {
            duplicateIdx = idx;
            break outer;
          }
        }
      }
    }

    if (duplicateIdx === -1) {
      // First time we've seen this location — seed its ratings list
      const key = cellKey(bathroom.latitude, bathroom.longitude);
      if (!grid[key]) grid[key] = [];
      grid[key].push(merged.length);
      merged.push({ ...bathroom, _ratings: [{ source: bathroom.source, rating: bathroom.rating }] });
    } else {
      // Same physical toilet seen again from a different source.
      // Keep the higher-priority source's fields but average ALL ratings together.
      const existing = merged[duplicateIdx];
      const allRatings = [...existing._ratings, { source: bathroom.source, rating: bathroom.rating }];
      const avgRating = parseFloat(
        (allRatings.reduce((s, r) => s + r.rating, 0) / allRatings.length).toFixed(1)
      );

      const incomingPriority = SOURCE_PRIORITY[bathroom.source] ?? 0;
      const existingPriority = SOURCE_PRIORITY[existing.source] ?? 0;
      const base = incomingPriority > existingPriority ? bathroom : existing;

      merged[duplicateIdx] = { ...base, rating: avgRating, _ratings: allRatings };
    }
  }

  // Expose the per-source breakdown as ratingDetails; drop internal accumulator
  return merged.map(({ _ratings, ...b }) => ({
    ...b,
    ratingDetails: _ratings,
  }));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchNearbyBathrooms(latitude, longitude, radiusMeters = 5000) {
  // Build the list of sources to query in parallel.
  // Global sources always run; city sources only run if the user is within their bounds.
  const activeCitySources = CITY_SOURCES
    .filter((s) => isWithinBounds(latitude, longitude, s.bounds))
    .map((s) => s.fetch(latitude, longitude, radiusMeters));

  const results = await Promise.allSettled([
    fetchFromOverpass(latitude, longitude, radiusMeters),   // 0
    fetchFromRefuge(latitude, longitude, radiusMeters),     // 1
    fetchFromWikidata(latitude, longitude, radiusMeters),   // 2
    fetchFromFoursquare(latitude, longitude, radiusMeters), // 3
    ...activeCitySources,                                   // 4+
  ]);

  const allBathrooms = results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value);

  if (allBathrooms.length === 0) {
    // Every source failed — throw the first error so the caller can handle it
    const firstFailure = results.find((r) => r.status === 'rejected');
    throw firstFailure?.reason || new Error('No data from any source');
  }

  const cityResults = results.slice(4).flatMap((r) => r.status === 'fulfilled' ? r.value : []);

  const merged = deduplicateBathrooms([
    // Priority order: city > foursquare > osm > refuge > wikidata
    cityResults,
    results[3]?.status === 'fulfilled' ? results[3].value : [], // foursquare
    results[0]?.status === 'fulfilled' ? results[0].value : [], // osm
    results[1]?.status === 'fulfilled' ? results[1].value : [], // refuge
    results[2]?.status === 'fulfilled' ? results[2].value : [], // wikidata
  ]).sort((a, b) => a.distance - b.distance);

  await saveCachedBathrooms(merged, latitude, longitude);
  return merged;
}
