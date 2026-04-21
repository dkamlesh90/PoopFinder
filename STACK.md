# Tech Stack

## Runtime & Framework

| Technology | Version | Role |
|---|---|---|
| [React Native](https://reactnative.dev) | 0.81.5 | Cross-platform mobile UI framework (iOS, Android) |
| [React](https://react.dev) | 19.1.0 | Component model and hooks |
| [Expo SDK](https://docs.expo.dev) | ~54.0.33 | Build toolchain, native API access, and dev workflow |

## Navigation & UI

| Technology | Version | Role |
|---|---|---|
| [@expo/vector-icons](https://docs.expo.dev/guides/icons/) | ^15.1.1 | Ionicons icon set |
| [expo-status-bar](https://docs.expo.dev/versions/latest/sdk/status-bar/) | ~3.0.9 | Status bar style control |
| [expo-splash-screen](https://docs.expo.dev/versions/latest/sdk/splash-screen/) | ~31.0.13 | Native splash screen control |
| [expo-font](https://docs.expo.dev/versions/latest/sdk/font/) | ~14.0.11 | Custom font loading |

Tab-based navigation is implemented manually in `App.js` — no external navigation library is used, keeping the dependency surface small.

## Maps

| Technology | Version | Role |
|---|---|---|
| [react-native-webview](https://github.com/react-native-webview/react-native-webview) | ~13.13.5 | Hosts the Leaflet map inside a native WebView |
| [Leaflet.js](https://leafletjs.com) | 1.9.4 | Open-source JS mapping library — loaded from unpkg CDN |
| [OpenStreetMap tile layer](https://tile.openstreetmap.org) | — | Free, open map tiles — no API key or billing account required |

No Google Maps SDK is used. Markers are rendered as `divIcon` elements; React Native communicates with the map via `injectJavaScript` (RN → map) and `postMessage` (map → RN).

## Location

| Technology | Version | Role |
|---|---|---|
| [expo-location](https://docs.expo.dev/versions/latest/sdk/location/) | ~19.0.8 | GPS permission requests and current position |

Location accuracy is set to `Balanced` to avoid unnecessary battery drain.

## Data

| Technology | Role |
|---|---|
| [Overpass API](https://overpass-api.de) | Queries OpenStreetMap for `amenity=toilets` nodes within a configurable radius |
| Three Overpass mirrors | Automatic fallback if the primary mirror is unavailable |
| Mock data module (`src/services/mockData.js`) | 8 hardcoded bathrooms offset from the user's GPS position — used during development (`USE_MOCK = true` in `bathroomService.js`) |

Distance and ratings are computed locally using the Haversine formula (`src/utils/geo.js`). No backend server is required.

## Persistence

| Technology | Version | Role |
|---|---|---|
| [@react-native-async-storage/async-storage](https://react-native-async-storage.github.io/async-storage/) | 2.2.0 | On-device storage for user bathroom ratings (Rate / Tinder screen) |

## Web Support

| Technology | Version | Role |
|---|---|---|
| [react-native-web](https://necolas.github.io/react-native-web/) | ^0.21.0 | Renders the React Native component tree in a browser |
| [react-dom](https://react.dev) | 19.1.0 | Required peer dependency for web rendering |
| [@expo/metro-runtime](https://github.com/expo/expo/tree/main/packages/%40expo/metro-runtime) | ~6.1.2 | Metro bundler runtime for web |

## Testing

| Technology | Version | Role |
|---|---|---|
| [Jest](https://jestjs.io) | ^29.7.0 | Test runner |
| [jest-expo](https://docs.expo.dev/develop/unit-testing/) | ~54.0.0 | Expo-aware Jest preset with correct module transforms |
| [@testing-library/react-native](https://callstack.github.io/react-native-testing-library/) | ^12.4.0 | Component rendering and interaction utilities |
| [react-test-renderer](https://react.dev/reference/react/test-renderer) | 19.1.0 | Required peer dependency for the testing library |

Run tests with:
```bash
npm test
```

## Language & Tooling

| Technology | Role |
|---|---|
| JavaScript (ES2022) | No TypeScript — faster iteration for a solo/small-team project |
| [Metro](https://metrobundler.dev) | React Native bundler (managed by Expo) |
| [Expo CLI](https://docs.expo.dev/more/expo-cli/) | `expo start` for local development; `expo start --android/--ios/--web` for platform targets |

## Architecture Summary

```
App.js                  — root state (location, bathrooms, selected tab)
├── src/screens/
│   ├── SplashScreen.js — animated intro, hides after 2.2 s
│   ├── MapScreen.js    — OSM map with bathroom markers
│   ├── ListScreen.js   — filterable, searchable sorted list
│   ├── DetailScreen.js — full info + Poop Score + directions
│   └── TinderScreen.js — swipe-to-rate with AsyncStorage persistence
├── src/components/
│   ├── BathroomCard.js — list row (memoized)
│   └── SwipeCard.js    — draggable swipe card with PanResponder
├── src/services/
│   ├── bathroomService.js — Overpass API fetch with mirror fallback
│   └── mockData.js        — static dev/demo fixtures
└── src/utils/
    └── geo.js             — Haversine distance, distance formatting, rating algorithm
```

State is managed entirely with React hooks in `App.js` and local component state — no Redux, Zustand, or Context API is needed at this scale.
