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

---

## 1. Overview

Poop Finder is a cross-platform React Native application (iOS, Android, Web) that helps users locate nearby public restrooms. It aggregates data from multiple free, no-key-required APIs, deduplicates results, caches them locally, and presents them through a map view, a sortable list, and a Tinder-style swipe rating interface.

**Bundle ID:** `com.poopfinder.app`  
**Expo Project ID:** `43a69e70-306e-47a0-a55f-83b3fbc809aa`  
**Owner:** `dkamlesh90`  
**Version:** `1.0.0`

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────┐
│                     App.js (root)                    │
│  • Location permission & GPS                         │
│  • Global bathroom state                             │
│  • Tab navigation                                    │
│  • Panic mode (instant directions)                   │
└────────────┬──────────────┬──────────────┬──────────┘
             │              │              │
        MapScreen      ListScreen    TinderScreen
        (native)       (FlatList)    (swipe cards)
        MapScreen.web
        (Leaflet)
             │
     ┌───────┴────────┐
     │  bathroomService│
     │  (data layer)   │
     └───────┬─────────┘
             │  Promise.allSettled (parallel)
    ┌────────┼────────┬──────────────┐
    │        │        │              │
 Overpass  Refuge  Wikidata    City APIs
  (OSM)            SPARQL      (NYC…)
             │
      AsyncStorage
       (local cache)
```

All three main screens stay **permanently mounted**. Tab switching uses `display: 'none'` rather than unmounting, which prevents the map from being re-initialised on every tab change.

---

## 3. Project Structure

```
PoopFinder/
├── App.js                        # Root component, location, global state
├── index.js                      # Expo entry point
├── app.json                      # Expo config (bundle IDs, permissions, plugins)
├── eas.json                      # EAS Build profiles
├── metro.config.js               # Metro bundler config (enables .web.js resolution)
├── package.json
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
│   │   ├── ListScreen.js         # Searchable/filterable bathroom list
│   │   ├── TinderScreen.js       # Swipe-to-rate interface
│   │   ├── DetailScreen.js       # Individual bathroom detail + poop score
│   │   └── SplashScreen.js       # Animated launch screen overlay
│   │
│   ├── components/
│   │   ├── BathroomCard.js       # List row card (memo)
│   │   └── SwipeCard.js          # Animated swipe card (PanResponder)
│   │
│   ├── services/
│   │   ├── bathroomService.js    # API fetching, dedup, caching
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

**State:**

| Variable | Type | Purpose |
|---|---|---|
| `location` | `{latitude, longitude}` \| null | User's GPS coordinates |
| `bathrooms` | `Bathroom[]` | Currently displayed results |
| `loading` | boolean | Network fetch in progress |
| `fromCache` | boolean | Current data is from local cache |
| `fromMock` | boolean | Current data is offline demo data |
| `tab` | `'map'`\|`'list'`\|`'tinder'` | Active tab |
| `selectedBathroom` | `Bathroom` \| null | Triggers DetailScreen |
| `locationError` | string \| null | Permission/GPS error message |

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
- Four filter chips: All / Free / Accessible / 24/7
- Results memoised via `useMemo` — only recomputes on `[bathrooms, filter, search]`
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

- `onPanResponderMove` uses `Animated.event([null, { dx: position.x, dy: position.y }], { useNativeDriver: true })` — runs entirely on the UI thread.
- `forceSwipe` and `resetPosition` both use `useNativeDriver: true`.
- Rotation and yes/no overlay opacity are derived via `.interpolate()` on `position.x`.
- The behind-card renders a lightweight static view with no gesture handlers.

---

### DetailScreen.js

Displays all fields for a selected bathroom plus a computed **Poop Score** (0–100):

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

Sources are passed to `deduplicateBathrooms` in priority order: **city > osm > refuge > wikidata**. When two entries are within 60 m of each other, the higher-priority source wins.

After deduplication, results are sorted by ascending distance and saved to cache before returning.

#### `deduplicateBathrooms(lists)`

Uses a spatial grid (cell size ≈ 0.001° ≈ 110 m) to avoid O(n²) distance comparisons. For each incoming bathroom, only the 3×3 neighbourhood of grid cells is checked — average case O(n).

#### Bathroom object shape

```js
{
  id: string,              // e.g. "osm_123456", "refuge_789", "nyc_abc"
  source: string,          // 'osm' | 'refuge' | 'wikidata' | 'city'
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
  distance: number,        // metres from user
  distanceLabel: string,   // e.g. "0.3 mi" or "150 ft"
  rating: number,          // 0–5, one decimal place
}
```

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
- `L.circle` — 1500 m radius semi-transparent purple fill showing the search area.

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
3. fetchNearbyBathrooms(lat, lon)  [background]
   ├─ Success → update UI, save new cache, clear badge
   └─ Fail    → loadCachedBathrooms()   (fresh)
               └─ null → loadStaleCachedBathrooms()  (any age)
                          └─ null → getMockBathrooms()
```

### Functions

| Function | TTL check | Radius check | Use case |
|---|---|---|---|
| `loadCachedBathrooms(lat, lon)` | Yes | Yes | Pre-load on startup / first fallback |
| `loadStaleCachedBathrooms()` | No | No | Last resort before mock data |
| `saveCachedBathrooms(data, lat, lon)` | — | — | Called (awaited) after successful fetch |

---

## 9. External APIs

All APIs are free with no API key required.

### Overpass (OpenStreetMap)

**Query:** Nodes, ways, and relations tagged `amenity=toilets`, `amenity=public_bath`, or `building=toilets` within the search radius.

**Mirrors (tried in order):**
1. `https://overpass-api.de/api/interpreter`
2. `https://overpass.kumi.systems/api/interpreter`
3. `https://maps.mail.ru/osm/tools/overpass/api/interpreter`

**Timeout:** 20 s per mirror  
**Method:** POST with `application/x-www-form-urlencoded` body

---

### Refuge Restrooms

**Endpoint:** `https://www.refugerestrooms.org/api/v1/restrooms/by_location.json`  
**Params:** `lat`, `lng`, `radius` (miles), `per_page=50`  
**Focus:** LGBTQ-safe, accessible restrooms  
**Timeout:** 15 s

---

### Wikidata SPARQL

**Endpoint:** `https://query.wikidata.org/sparql`  
**Query:** Items of type Q6649324 (public toilet) within radius using `wikibase:around` geo service  
**Timeout:** 8 s (reduced from 20 s — Wikidata is slow and blocks `Promise.allSettled`)

---

### NYC Open Data (Socrata SODA)

**Endpoint:** `https://data.cityofnewyork.us/resource/i7jb-7jku.json`  
**Filter:** `within_circle(location, lat, lon, radius)` spatial filter  
**Limit:** 100 results  
**Active when:** User is within NYC bounding box (lat 40.4–40.92, lon −74.26–−73.68)  
**Timeout:** 15 s

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

Local component state:
- `ListScreen` — `filter`, `search`
- `TinderScreen` — `queue`, `ratings`, `showSummary`

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
| Memoised list results | `ListScreen.js` | `useMemo` on `[bathrooms, filter, search]` |
| Memoised cards | `BathroomCard.js` | `React.memo` prevents re-renders when parent re-renders |
| FlatList tuning | `ListScreen.js` | `initialNumToRender=8`, `maxToRenderPerBatch=8`, `windowSize=5`, `removeClippedSubviews` |
| Parallel API fetch | `bathroomService.js` | `Promise.allSettled` — all sources race simultaneously |
| Wikidata timeout | `bathroomService.js` | 8 s cap prevents slow Wikidata from blocking the full result |
| Stale-while-revalidate | `App.js` | Cache shown immediately on startup; fresh fetch runs in background |

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

### Store submission requirements

**iOS:**
- Apple Developer account ($99/year)
- `appleId`, `ascAppId`, `appleTeamId` in `eas.json` submit config

**Android:**
- Google Play Developer account ($25 one-time)
- Service account JSON key at `./google-play-service-account.json`

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

- `MapScreen.web.js` is auto-selected by Metro's platform extension resolution.
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
