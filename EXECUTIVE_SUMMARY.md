# Poop Finder — Executive Summary

## What It Is

Poop Finder is a free mobile and web application that helps people locate the nearest public restroom in real time. Users open the app, see an interactive map of nearby bathrooms, and can get directions instantly — no account, no subscription, no ads.

## The Problem It Solves

Finding a clean, accessible, free public restroom in an unfamiliar area is a surprisingly difficult and stressful experience. Existing solutions are fragmented across city websites, Google Maps searches, and word of mouth. Poop Finder aggregates all available public data sources into one fast, offline-capable app.

## How It Works

The app requests the user's location and simultaneously queries four independent data sources — OpenStreetMap, Refuge Restrooms, Wikidata, and city open data portals (starting with NYC) — all in parallel and without requiring any API keys or fees. Results are deduplicated, scored, and displayed in under ten seconds. If the network is unavailable, the app falls back to cached results from the last successful fetch, or a built-in set of demo locations.

## Key Features

| Feature | Description |
|---|---|
| **Live Map** | Interactive map with bathroom markers, user location, and a 1.5 km search radius overlay |
| **Nearby List** | Searchable list sorted by distance with ratings, accessibility badges, and fee indicators |
| **Rate & Review** | Tinder-style swipe interface to rate bathrooms ("Would Poop" / "Hard Pass") with a personal summary |
| **Filters** | Global filters for distance, free entry, wheelchair accessibility, baby changing tables, 24/7 hours, and minimum rating — applied across all tabs simultaneously |
| **Poop Score** | A 0–100 score for each bathroom based on cost, accessibility, hours, and proximity |
| **Panic Mode** | One-tap 🚨 button that immediately opens the device maps app with directions to the nearest free restroom |
| **Offline Mode** | 30-minute local cache with stale fallback — the app remains useful with no network connection |

## Platforms

- **iOS** (iPhone and iPad)
- **Android**
- **Web** (any modern browser)

All three platforms are built from a single shared codebase using React Native and Expo.

## Data Sources

All data is free and requires no API keys:

- **OpenStreetMap / Overpass** — global crowdsourced toilet data
- **Refuge Restrooms** — LGBTQ-inclusive safe restroom database
- **Wikidata** — knowledge graph entries for public toilets
- **NYC Open Data** — official New York City public restroom dataset (more cities planned)

## Technology

Built with React Native (Expo SDK 54), targeting iOS, Android, and web from a single codebase. Maps are rendered using Leaflet.js on OpenStreetMap tiles — no Google Maps, no paid map API. Data is cached locally using AsyncStorage. The app is distributed via Expo Application Services (EAS) cloud builds.

## Business Model

Currently free with no monetisation. Potential future revenue streams include:
- Sponsored listings for businesses with clean restrooms
- A premium tier with real-time crowd-sourced cleanliness ratings
- White-label licensing to transit authorities, tourism boards, and accessibility organisations

## Current Status

- ✅ iOS and Android builds available via EAS (internal distribution)
- ✅ Web app running
- ✅ Core features complete: map, list, swipe rating, filters, offline cache, panic mode
- 🔜 Additional city open data integrations (SF, Chicago, LA, Seattle, Denver)
- 🔜 App Store and Google Play submission
