# Poop Finder — Technical Documentation

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Project Structure](#3-project-structure)
4. [Tech Stack](#4-tech-stack)
5. [Screens & Components](#5-screens--components)
6. [Data Layer](#6-data-layer)
7. [Mapping](#7-mapping)
8. [Caching Strategy](#8-caching-strategy)
9. [External APIs](#9-external-apis)
10. [Geo Utilities](#10-geo-utilities)
11. [State Management](#11-state-management)
12. [Performance](#12-performance)
13. [Build & Deployment](#13-build--deployment)
14. [Testing](#14-testing)
15. [Platform Specifics](#15-platform-specifics)
16. [Asset Pipeline](#16-asset-pipeline)
17. [Version Control](#17-version-control)

---

## 1. Overview

Poop Finder is a cross-platform React Native application (iOS, Android, Web) that helps users locate nearby public restrooms. It aggregates data from six free APIs, deduplicates results using a spatial grid, caches them locally, and presents them through a map view, a sortable list, and a Tinder-style swipe rating interface. Community reviews from Foursquare and OpenStreetMap are shown on each bathroom's detail page.

**Bundle ID:** `com.poopfinder.app`  
**Expo Project ID:** `43a69e70-306e-47a0-a55f-83b3fbc809aa`  
**Owner:** `dkamlesh90`  
**Version:** `1.0.0`  
**Repository:** `https://github.com/dkamlesh90/PoopFinder`

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      App.js (root)                        │
│  • Location permission & GPS                              │
│  • Global bathroom state + filter state                   │
│  • Tab navigation (always-mounted, display:none)          │
│  • Panic mode (instant directions)                        │
│  • FilterModal (global distance/feature/rating filters)   │
└─────────────┬───────────────┬───────────────┬────────────┘
              │               │               │
         MapScreen       ListScreen     TinderScreen
         (native)        (FlatList)     (swipe cards)
         MapScreen.web
         (Leaflet)
              │
      ┌───────┴────────┐
      │  bathroomService│
      │  (data layer)   │
      └───────┬─────────┘
              │  Promise.allSettled (parallel)
   ┌──────────┼──────────┬────────────┬─────────────┐
   │          │          │            │             │
Overpass   Refuge    Wikidata   Foursquare    City APIs
 (OSM)              SPARQL     Places v3     (NYC…)
              │
       AsyncStorage
        (local cache)

DetailScreen (overlay)
   └── fetchFoursquareTips(fsq_id)
   └── fetchOSMNotesNear(lat, lon)
```

All three main screens stay **permanently mounted**. Tab switching uses `display: 'none'` rather than unmounting, which prevents the map from being re-initialised on every tab change.

The `filteredBathrooms` array (derived from `bathrooms` + `filters` via `useMemo`) is passed to all screens. The raw `bathrooms` array is only modified by network fetches or cache loads.

---

## 3. Project Structure

```
PoopFinder/
├── App.js                        # Root component, location, global state, filters
├── index.js                      # Expo entry point
├── app.json                      # Expo config (bundle IDs, permissions, plugins)
├── eas.json                      # EAS Build profiles
├── metro.config.js               # Metro bundler config (enables .web.js resolution)
├── package.json
├── .env                          # EXPO_PUBLIC_FOURSQUARE_API_KEY (gitignored)
│
├── assets/
│   ├── icon.png                  # 1024×1024 — iOS/Android store icon
│   ├── adaptive-icon.png         # 1024×1024 — Android adaptive foreground
│   ├── splash-icon.png           # 1024×1024 — launch screen
│   └── favicon.png               # 48×48 — browser tab
│
├── src/
│   ├── screens/
│   │   ├── MapScreen.js          # Native map (iOS/Android) via WebView + Leaflet
│   │   ├── MapScreen.web.js      # Web map — Leaflet loaded directly into DOM
│   │   ├── ListScreen.js         # Searchable bathroom list
│   │   ├── TinderScreen.js       # Swipe-to-rate interface
│   │   ├── DetailScreen.js       # Bathroom detail + poop score + community reviews
│   │   └── SplashScreen.js       # Animated launch screen overlay
│   │
│   ├── components/
│   │   ├── BathroomCard.js       # List row card (memo)
│   │   ├── SwipeCard.js          # Animated swipe card (PanResponder)
│   │   └── FilterModal.js        # Global filter bottom sheet
│   │
│   ├── services/
│   │   ├── bathroomService.js    # API fetching, dedup, caching, reviews
│   │   └── mockData.js           # Offline demo data (8 entries)
│   │
│   └── utils/
│       └── geo.js                # Haversine distance, distance formatting, rating
│
└── scripts/
    └── generate-icons.js         # SVG → PNG icon generator (@resvg/resvg-js)
```

---

## 4. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | React Native | 0.81.5 |
| Platform | Expo SDK | ~54.0.33 |
| React | React | 19.1.0 |
| Web support | React Native Web | ^0.21.0 |
| Web bundler | Metro (via expo/metro-config) | — |
| Map (native) | react-native-webview + Leaflet.js | 13.15.0 / 1.9.4 |
| Map (web) | Leaflet.js (CDN) | 1.9.4 |
| Map tiles | OpenStreetMap | — |
| Local storage | @react-native-async-storage | 2.2.0 |
| Icons | @expo/vector-icons (Ionicons) | ^15.1.1 |
| Location | expo-location | ~19.0.8 |
| Splash screen | expo-splash-screen | ~31.0.13 |
| Build service | EAS Build | ≥18.0.0 |
| Icon generation | @resvg/resvg-js | ^2.6.2 |
| Testing | jest-expo + @testing-library/react-native | — |

---

## 5. Screens & Components

### App.js

The root component owns all global state and orchestrates startup:

1. Calls `ExpoSplashScreen.preventAutoHideAsync()` on module load to hold the native splash.
2. On mount: hides the native splash, requests location permission, pre-loads valid cache, then starts a background fresh fetch.
3. Renders a persistent tab bar (Map / Nearby / Rate) and conditionally shows `DetailScreen` over all tabs when a bathroom is selected.
4. **Panic mode** — the 🚨 button immediately opens the device maps app with directions to the nearest free restroom.
5. **Filter button** — opens `FilterModal`; badge shows count of active non-default filters.

**State:**

| Variable | Type | Purpose |
|---|---|---|
| `location` | `{latitude, longitude}` \| null | User's GPS coordinates |
| `bathrooms` | `Bathroom[]` | Full unfiltered results from last fetch/cache |
| `filters` | `FilterState` | Current filter values (distance, features, rating) |
| `filterVisible` | boolean | Controls `FilterModal` visibility |
| `filteredBathrooms` | `Bathroom[]` | `useMemo` — `bathrooms` after `applyFilters` |
| `loading` | boolean | Network fetch in progress |
| `fromCache` | boolean | Current data is from local cache |
| `fromMock` | boolean | Current data is offline demo data |
| `tab` | `'map'`\|`'list'`\|`'tinder'` | Active tab |
| `selectedBathroom` | `Bathroom` \| null | Triggers DetailScreen |
| `locationError` | string \| null | Permission/GPS error message |
| `lastFetchedRadiusRef` | `useRef<number>` | Tracks the radius of the last successful fetch |

**Dynamic fetch radius:**

`loadBathrooms` accepts a `radiusMeters` parameter. When the user changes the distance filter, `onApply` only triggers a new network fetch if the new radius **exceeds** `lastFetchedRadiusRef.current`. Smaller distance changes only apply client-side filtering, avoiding redundant API calls.

```js
const loadBathrooms = useCallback(async (coords, radiusMeters = DEFAULT_RADIUS) => {
  setLoading(true);
  try {
    const results = await fetchNearbyBathrooms(coords.latitude, coords.longitude, radiusMeters);
    lastFetchedRadiusRef.current = radiusMeters;
    setBathrooms(results);
  } catch {
    const cached = (await loadCachedBathrooms(coords.latitude, coords.longitude))
                ?? (await loadStaleCachedBathrooms());
    if (cached) { setBathrooms(cached); setFromCache(true); }
    else { setBathrooms(getMockBathrooms(...)); setFromMock(true); }
  } finally { setLoading(false); }
}, []);
```

---

### FilterModal.js

A bottom-sheet modal providing global filtering across all tabs.

**Exports:**

| Export | Type | Description |
|---|---|---|
| `DEFAULT_FILTERS` | object | Default filter state |
| `countActiveFilters(filters)` | function | Returns count of non-default active filters |
| `applyFilters(bathrooms, filters)` | function | Returns filtered subset of bathroom array |
| `FilterModal` (default) | component | Bottom-sheet UI |

**Filter options:**

| Filter | UI | Default |
|---|---|---|
| Max distance | Chips: 0.1 / 0.25 / 0.5 / 1 / 2 / 3 / 5 / 10 / 25 mi | 5 mi |
| Free only | Toggle | Off |
| Wheelchair accessible | Toggle | Off |
| Baby changing table | Toggle | Off |
| Open 24/7 | Toggle | Off |
| Minimum rating | Chips: Any / ★3+ / ★4+ / ★4.5+ | Any |

**`applyFilters` logic:**

```js
export function applyFilters(bathrooms, filters) {
  const maxM = filters.maxDistanceMi * 1609.344;
  return bathrooms.filter((b) => {
    if (b.distance > maxM) return false;
    if (filters.freeOnly && b.fee) return false;
    if (filters.accessibleOnly && !b.accessible) return false;
    if (filters.changingTable && !b.changingTable) return false;
    if (filters.open24h && b.openingHours !== '24/7') return false;
    if (filters.minRating > 0 && b.rating < filters.minRating) return false;
    return true;
  });
}
```

---

### MapScreen.js (native — iOS/Android)

Renders a `WebView` containing a self-contained HTML page that loads Leaflet.js from unpkg CDN.

- `baseUrl: 'https://tile.openstreetmap.org'` gives the WebView an HTTPS origin so Android WebView allows CDN fetches.
- SRI `integrity`/`crossorigin` attributes are omitted — they fail CORS preflight from a WebView null origin.
- Communication is bi-directional via `postMessage` / `injectJavaScript`.
- Bathroom markers are injected by calling `window.updateBathrooms(list)` via `injectJavaScript`.
- Marker tap events post `{ type: 'SELECT', id }` back to React Native via `ReactNativeWebView.postMessage`.
- The "center on me" button calls `window.centerMap()` via `injectJavaScript`.
- Map HTML is memoised on `[location.latitude, location.longitude]` — the WebView only rebuilds if the user moves far enough to trigger a location change.

---

### MapScreen.web.js (web)

Metro automatically picks this file over `MapScreen.js` for web builds due to the `.web.js` platform extension.

Leaflet is loaded once via a module-level singleton promise (`loadLeaflet()`). The map container is a `<View nativeID={mapId} />` — `nativeID` maps to the HTML `id` attribute in React Native Web, allowing `document.getElementById` to get the real DOM node (View refs return component instances, not HTMLElements, on web).

A `requestAnimationFrame` defers Leaflet initialisation until after the container has been painted and has non-zero dimensions.

---

### ListScreen.js

A `FlatList` of `BathroomCard` components with:
- Text search (filters by name)
- Results memoised via `useMemo` on `[bathrooms, search]` — global filtering is handled upstream by `applyFilters` in App.js
- FlatList tuned: `initialNumToRender={8}`, `maxToRenderPerBatch={8}`, `windowSize={5}`, `removeClippedSubviews`

---

### TinderScreen.js

Swipe-to-rate interface backed by `AsyncStorage` under key `@poopfinder_ratings`.

- Maintains a `queue` of unrated bathrooms. On mount, it loads saved ratings and filters them out of the queue.
- Two `SwipeCard` components are rendered simultaneously (top card + peek of next card behind it).
- Swipe right = "Would Poop" (`yes`), swipe left = "Hard Pass" (`no`), action buttons map to the same handlers.
- After all cards are rated, shows a `Summary` component with a breakdown and "Best Pick Nearby" highlight.

---

### SwipeCard.js

Uses `Animated.ValueXY` + `PanResponder` for gesture handling.

- `onPanResponderMove` uses `Animated.event([null, { dx: position.x, dy: position.y }], { useNativeDriver: true })` — runs entirely on the UI thread at 60 fps.
- `forceSwipe` and `resetPosition` both use `useNativeDriver: true`.
- Rotation and yes/no overlay opacity are derived via `.interpolate()` on `position.x`.

---

### DetailScreen.js

Displays all fields for a selected bathroom plus a computed **Poop Score** (0–100) and **Community Reviews**.

**Poop Score:**

| Condition | Points |
|---|---|
| Base score | 50 |
| Free to use | +20 |
| Costs money | −15 |
| Wheelchair accessible | +10 |
| Baby changing table | +5 |
| Open 24/7 | +15 |
| Distance < 200 m | +15 |
| Distance < 500 m | +8 |
| Distance > 1000 m | −10 |

**Community Reviews:**

On mount, `useEffect` fires two parallel requests:
1. `fetchFoursquareTips(bathroom.fsq_id)` — only called if the bathroom has a Foursquare ID
2. `fetchOSMNotesNear(bathroom.latitude, bathroom.longitude, 200)` — OSM Notes within 200 m

Reviews from both sources are merged into a single list. Each `ReviewRow` displays a source badge (orange = Foursquare, green = OSM Note), date, agree count (Foursquare only), and review text.

---

### SplashScreen.js

An `Animated.View` that sits at `zIndex: 999` over everything. Runs a sequence: emoji spring-in → title slide-up → subtitle fade → loading dots bounce loop → fade out after 2.2 s. All animations use `useNativeDriver: true`.

---

### BathroomCard.js

A `memo`-wrapped list row. Accessibility label is computed with `useMemo` and combines name, distance, rating, and features into a single screen-reader string.

---

## 6. Data Layer

### bathroomService.js

#### `fetchNearbyBathrooms(latitude, longitude, radiusMeters = 5000)`

Fires all sources in parallel with `Promise.allSettled`. Any number of sources can fail without blocking the result — the merged set from all successful sources is returned. If every source fails, the first rejection error is thrown.

Source priority order (higher wins dedup):

| Priority | Source | Key |
|---|---|---|
| 5 | City open data (NYC…) | `city` |
| 4 | Foursquare Places v3 | `foursquare` |
| 3 | OpenStreetMap / Overpass | `osm` |
| 2 | Refuge Restrooms | `refuge` |
| 1 | Wikidata | `wikidata` |

`Promise.allSettled` index mapping:
- `[0]` = Overpass
- `[1]` = Refuge
- `[2]` = Wikidata
- `[3]` = Foursquare
- `[4+]` = City sources

After deduplication, results are sorted by ascending distance and saved to cache before returning.

#### `deduplicateBathrooms(lists)`

Uses a spatial grid (cell size ≈ 0.001° ≈ 110 m) to avoid O(n²) distance comparisons. For each incoming bathroom, only the 3×3 neighbourhood of grid cells is checked — average case O(n). The first occurrence of a bathroom in priority order is kept; duplicates within 60 m are discarded.

#### Bathroom object shape

```js
{
  id: string,              // e.g. "osm_123456", "refuge_789", "nyc_abc", "fsq_abc123"
  source: string,          // 'osm' | 'refuge' | 'wikidata' | 'city' | 'foursquare'
  fsq_id: string | null,   // Foursquare venue ID (used to fetch tips)
  latitude: number,
  longitude: number,
  name: string,
  fee: boolean,
  accessible: boolean,
  changingTable: boolean,
  openingHours: string | null,
  unisex: boolean,
  male: boolean,
  female: boolean,
  description: string | null,
  image: string | null,    // Photo URL (Foursquare only)
  distance: number,        // metres from user
  distanceLabel: string,   // e.g. "0.3 mi" or "150 ft"
  rating: number,          // 0–5, one decimal place
}
```

#### `fetchFoursquareTips(fsq_id)` — exported

Fetches up to 10 user tips for a Foursquare venue. Returns:
```js
[{ source: 'foursquare', text: string, createdAt: string, agreeCount: number, disagreeCount: number }]
```
Returns `[]` on error.

#### `fetchOSMNotesNear(latitude, longitude, radiusMeters = 300)` — exported

Fetches OSM Notes within `radiusMeters` of the given coordinates. Filters notes to only those containing bathroom-related keywords (`toilet`, `restroom`, `bathroom`, `wc`, `loo`, `lavatory`, `washroom`). Returns:
```js
[{ source: 'osm_note', text: string, createdAt: string }]
```
Returns `[]` on error.

---

## 7. Mapping

### Tiles

OpenStreetMap raster tiles via `https://tile.openstreetmap.org/{z}/{x}/{y}.png`. No API key required. Attribution is rendered per OSM requirements.

### Leaflet.js

Loaded from `https://unpkg.com/leaflet@1.9.4/dist/leaflet.js` (CDN). Version is pinned to avoid unexpected breaking changes.

### Markers

Custom `DivIcon` markers — a circular `<div>` with a 🚽 emoji. Selected marker gets the `.sel` CSS class (scale 1.25, lavender background).

### User location indicator

- `L.circleMarker` — filled blue dot for the user's position.
- `L.circle` — radius semi-transparent purple fill showing the current search area. Radius scales with the selected distance filter.

---

## 8. Caching Strategy

Storage key: `@poopfinder_bathroom_cache`  
Cache TTL: **30 minutes**  
Invalidation radius: **0.05° (~5 km)**

### Load sequence on app start

```
1. Request GPS
2. loadCachedBathrooms(lat, lon)
   ├─ Valid (fresh + nearby)  → show immediately with "📦 Cached" badge
   └─ Invalid / missing       → skip
3. fetchNearbyBathrooms(lat, lon, radiusMeters)  [background]
   ├─ Success → update UI, await saveCachedBathrooms(), clear badge
   └─ Fail    → loadCachedBathrooms()        (fresh, ignores previous step)
               └─ null → loadStaleCachedBathrooms()   (any age, no radius check)
                          └─ null → getMockBathrooms()
```

### Functions

| Function | TTL check | Radius check | Use case |
|---|---|---|---|
| `loadCachedBathrooms(lat, lon)` | Yes | Yes | Pre-load on startup / first fallback |
| `loadStaleCachedBathrooms()` | No | No | Last resort before mock data |
| `saveCachedBathrooms(data, lat, lon)` | — | — | Called with `await` after successful fetch |

`saveCachedBathrooms` is explicitly awaited to prevent a race condition where a rapid re-fetch could read a partially-written cache entry.

---

## 9. External APIs

### Overpass (OpenStreetMap)

**Query:** Nodes, ways, and relations tagged `amenity=toilets`, `amenity=public_bath`, or `building=toilets` within the search radius.

**Mirrors (tried in order):**
1. `https://overpass-api.de/api/interpreter`
2. `https://overpass.kumi.systems/api/interpreter`
3. `https://maps.mail.ru/osm/tools/overpass/api/interpreter`

**Timeout:** Scales dynamically: `Math.min(60, Math.ceil(30 * (radiusMeters / 5000)))` seconds — proportional to fetch radius, capped at 60 s  
**API key:** None  
**Method:** POST with `application/x-www-form-urlencoded`

---

### Refuge Restrooms

**Endpoint:** `https://www.refugerestrooms.org/api/v1/restrooms/by_location.json`  
**Params:** `lat`, `lng`, `radius` (miles), `per_page=50`  
**Focus:** LGBTQ-safe, accessible restrooms  
**Timeout:** 15 s  
**API key:** None

---

### Wikidata SPARQL

**Endpoint:** `https://query.wikidata.org/sparql`  
**Query:** Items of type Q6649324 (public toilet) within radius using `wikibase:around` geo service  
**Timeout:** 8 s (capped to prevent slow Wikidata responses from blocking `Promise.allSettled`)  
**API key:** None

---

### NYC Open Data (Socrata SODA)

**Endpoint:** `https://data.cityofnewyork.us/resource/i7jb-7jku.json`  
**Filter:** `within_circle(location, lat, lon, radius)` spatial filter  
**Limit:** 100 results  
**Active when:** User is within NYC bounding box (lat 40.4–40.92, lon −74.26–−73.68)  
**Timeout:** 15 s  
**API key:** None

---

### Foursquare Places v3

**Search endpoint:** `https://api.foursquare.com/v3/places/search`  
**Tips endpoint:** `https://api.foursquare.com/v3/places/{fsq_id}/tips`  
**Params (search):** `query=public restroom toilet bathroom`, `ll={lat},{lon}`, `radius`, `limit=50`, `fields=fsq_id,name,location,geocodes,rating,photos,hours,description,features,price`  
**Auth:** `Authorization: {API_KEY}` header  
**API key:** Required — free tier available. Stored in `.env` as `EXPO_PUBLIC_FOURSQUARE_API_KEY` (gitignored)  
**Notes:** Foursquare ratings are on a 0–10 scale; `parseFoursquarePlace` normalises to 0–5. `fsq_id` is stored on the bathroom object and used to fetch tips in `DetailScreen`.

---

### OSM Notes API

**Endpoint:** `https://api.openstreetmap.org/api/0.6/notes.json`  
**Params:** `bbox={lon-r},{lat-r},{lon+r},{lat+r}`, `limit=50`, `closed=0`  
**Filtering:** Notes are filtered client-side for bathroom-related keywords in comment text  
**API key:** None  
**Used for:** Community reviews in `DetailScreen` — raw field reports from OSM contributors near the bathroom location

---

## 10. Geo Utilities

**`getDistanceMeters(lat1, lon1, lat2, lon2)`**  
Haversine formula using Earth radius R = 6,371,000 m. Returns metres as a float.

**`formatDistance(meters)`**  
Converts to US customary units:
- < 0.1 mi → feet (e.g. `"150 ft"`)
- < 10 mi → one decimal mile (e.g. `"0.3 mi"`)
- ≥ 10 mi → rounded mile (e.g. `"12 mi"`)

**`computeRating({ wheelchair, changing_table, fee, opening_hours })`**  
Produces a 0–5 star rating (one decimal):

| Feature | Bonus |
|---|---|
| Base | 3.0 |
| Wheelchair accessible | +0.5 |
| Changing table | +0.3 |
| Free (no fee) | +0.2 |
| Open 24/7 | +0.5 |

---

## 11. State Management

No external state library. All state lives in `App.js` and is passed down as props. Screens are stateless with respect to bathroom data.

`filteredBathrooms` is computed in `App.js` via `useMemo`:

```js
const filteredBathrooms = useMemo(
  () => applyFilters(bathrooms, filters),
  [bathrooms, filters]
);
```

All three screens and `DetailScreen` receive `filteredBathrooms`, not `bathrooms`. This means filter changes are reflected everywhere simultaneously without triggering new network requests (unless the new distance radius exceeds the last fetched radius).

Local component state:
- `ListScreen` — `search`
- `TinderScreen` — `queue`, `ratings`, `showSummary`
- `DetailScreen` — `reviews`, `reviewsLoading`

Persistence:
- Bathroom cache — `AsyncStorage` (`@poopfinder_bathroom_cache`)
- Swipe ratings — `AsyncStorage` (`@poopfinder_ratings`)

---

## 12. Performance

| Optimisation | Where | Detail |
|---|---|---|
| Screens never unmount | `App.js` | `display: 'none'` on inactive tabs instead of conditional rendering — prevents Leaflet/WebView re-init |
| Native-driver animations | `SwipeCard.js` | `useNativeDriver: true` on all Animated values — runs on UI thread at 60 fps |
| O(n) deduplication | `bathroomService.js` | Spatial grid replaces O(n²) `Array.find` + distance loop |
| Memoised map HTML | `MapScreen.js` | `useMemo` on `[lat, lon]` — WebView only rebuilds on location change |
| Memoised filtered list | `App.js` | `useMemo([bathrooms, filters])` — filter recompute only when inputs change |
| Memoised cards | `BathroomCard.js` | `React.memo` prevents re-renders when parent re-renders |
| FlatList tuning | `ListScreen.js` | `initialNumToRender=8`, `maxToRenderPerBatch=8`, `windowSize=5`, `removeClippedSubviews` |
| Parallel API fetch | `bathroomService.js` | `Promise.allSettled` — all six sources race simultaneously |
| Dynamic Overpass timeout | `bathroomService.js` | Timeout scales with radius: `Math.min(60, Math.ceil(30 * (r / 5000)))` s |
| Wikidata timeout cap | `bathroomService.js` | 8 s cap prevents slow Wikidata from blocking the full result |
| Smart re-fetch on filter | `App.js` | New fetch only when distance filter exceeds `lastFetchedRadiusRef.current` |
| Stale-while-revalidate | `App.js` | Cache shown immediately on startup; fresh fetch runs in background |
| Awaited cache save | `bathroomService.js` | `await saveCachedBathrooms()` prevents race condition on rapid re-fetch |

---

## 13. Build & Deployment

### Local development

```bash
npx expo start          # interactive — shows QR code
npx expo start --web    # web only
```

### EAS Build profiles (`eas.json`)

| Profile | Platform | Output | Use case |
|---|---|---|---|
| `development` | iOS (simulator) | Dev client | Local development with native modules |
| `preview` | Android | APK | Internal testing, sharable via QR |
| `preview` | iOS | IPA (internal) | Internal testing (requires Apple account) |
| `production` | Both | Store binary | App Store / Play Store submission |

```bash
# Android APK (no Apple account needed)
npx eas build --profile preview --platform android

# iOS (requires Apple Developer account)
npx eas build --profile preview --platform ios

# Submit to stores
npx eas submit --profile production --platform android
npx eas submit --profile production --platform ios
```

App version is managed remotely (`appVersionSource: "remote"`) and auto-increments on production builds.

### Environment variables

Sensitive keys are stored in `.env` (gitignored) and accessed via Expo's `EXPO_PUBLIC_` prefix, which Metro inlines at build time:

```
EXPO_PUBLIC_FOURSQUARE_API_KEY=<key>
```

For EAS cloud builds, add the same key as a secret in the EAS dashboard (`eas secret:create`).

---

## 14. Testing

```bash
npm test
```

Test framework: `jest-expo` preset with `@testing-library/react-native`.

| Test file | Covers |
|---|---|
| `utils/__tests__/geo.test.js` | `getDistanceMeters`, `formatDistance`, `computeRating` |
| `services/__tests__/mockData.test.js` | `getMockBathrooms` shape and sorting |
| `services/__tests__/bathroomService.test.js` | Cache logic, fetch fallback chain |
| `components/__tests__/BathroomCard.test.js` | Card rendering and accessibility label |
| `screens/__tests__/ListScreen.test.js` | Filter and search logic |

---

## 15. Platform Specifics

### iOS

- `NSLocationWhenInUseUsageDescription` and `NSLocationAlwaysUsageDescription` set in `app.json` `infoPlist`.
- `ITSAppUsesNonExemptEncryption: false` — avoids App Store encryption compliance questions.
- Map directions use the `maps:` URL scheme.
- `supportsTablet: true`.

### Android

- Permissions: `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`.
- `edgeToEdgeEnabled: true` — content draws behind system bars.
- Adaptive icon: white toilet foreground on `#f8f4ff` background.
- Map directions use the `geo:` URL scheme.
- WebView requires `baseUrl` set to an HTTPS origin to allow CDN resource loading.

### Web

- `MapScreen.web.js` is auto-selected by Metro's platform extension resolution (requires `metro.config.js` using `expo/metro-config`).
- Leaflet is loaded via CDN script injection into the page DOM.
- `nativeID` prop (React Native Web) maps to the HTML `id` attribute, enabling `document.getElementById` to get a real `HTMLElement` for Leaflet to attach to.

---

## 16. Asset Pipeline

Icons are generated from SVG source using a Node.js script:

```bash
node scripts/generate-icons.js
```

Uses `@resvg/resvg-js` (Rust-based SVG renderer, pre-built binaries — no compilation required on any platform).

| Output file | Size | Used by |
|---|---|---|
| `assets/icon.png` | 1024×1024 | iOS App Store, Android Play Store, Expo |
| `assets/adaptive-icon.png` | 1024×1024 | Android adaptive icon foreground |
| `assets/splash-icon.png` | 1024×1024 | Launch/splash screen |
| `assets/favicon.png` | 48×48 | Browser tab (web) |

All icon designs use the brand gradient (`#9333EA → #3B0764`) with a map-pin + toilet motif.

---

## 17. Version Control

**Repository:** `https://github.com/dkamlesh90/PoopFinder`  
**Branch:** `main`  
**Line endings:** LF (normalised via `.gitattributes` — `* text=auto eol=lf`)

### .gitignore highlights

- `node_modules/`, `.expo/`, `dist/`, `web-build/`
- `.env` — API keys never committed
- `google-play-service-account.json` — EAS credentials never committed
- `/ios`, `/android` — generated native folders excluded
- `.claude/` — Claude Code internal state excluded

### .gitattributes

- All text files normalised to LF in the repo
- PNG, JPG, GIF, ICO treated as binary (no line-ending translation)
- SVG treated as text with LF endings
