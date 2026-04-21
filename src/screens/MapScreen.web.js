// Web-specific MapScreen.
// Metro picks this file automatically for web builds; MapScreen.js is used for native.

import { useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ─── Leaflet loader (singleton so the CDN is only fetched once) ───────────────

let _leafletPromise = null;

function loadLeaflet() {
  if (_leafletPromise) return _leafletPromise;
  _leafletPromise = new Promise((resolve, reject) => {
    if (window.L) { resolve(window.L); return; }

    const css = document.createElement('link');
    css.rel  = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);

    const js  = document.createElement('script');
    js.src    = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    js.onload  = () => resolve(window.L);
    js.onerror = () => { _leafletPromise = null; reject(); };
    document.head.appendChild(js);
  });
  return _leafletPromise;
}

function ensureMarkerCSS() {
  if (document.getElementById('pf-marker-css')) return;
  const s = document.createElement('style');
  s.id = 'pf-marker-css';
  s.textContent = `
    .pf-ti {
      width:36px; height:36px; border-radius:50%;
      background:#fff; border:2.5px solid #7C3AED;
      display:flex; align-items:center; justify-content:center;
      font-size:20px; cursor:pointer;
      box-shadow:0 2px 8px rgba(0,0,0,.2);
      transition:transform .15s,background .15s;
    }
    .pf-ti.sel { background:#EDE9FE; border-color:#5B21B6; transform:scale(1.25); }
  `;
  document.head.appendChild(s);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MapScreen({ location, bathrooms, loading, onSelectBathroom }) {
  // Use a stable unique id so we can find the real DOM node via getElementById.
  // Relying on ref.current for a RN View gives a component instance, not an HTMLElement.
  const mapId         = useRef(`pf-map-${Math.random().toString(36).slice(2)}`).current;
  const mapRef        = useRef(null);
  const layerRef      = useRef(null);
  const elsRef        = useRef({});
  const bathroomsRef  = useRef(bathrooms);
  const onSelectRef   = useRef(onSelectBathroom);
  bathroomsRef.current = bathrooms;
  onSelectRef.current  = onSelectBathroom;

  // ── Initialise the Leaflet map ─────────────────────────────────────────────
  useEffect(() => {
    if (!location) return;
    let cancelled = false;

    loadLeaflet().then((L) => {
      if (cancelled || mapRef.current) return;

      // requestAnimationFrame guarantees the div has been painted and has dimensions
      requestAnimationFrame(() => {
        if (cancelled) return;
        const container = document.getElementById(mapId);
        if (!container) return;

        ensureMarkerCSS();

        const map = L.map(container, { zoomControl: false })
          .setView([location.latitude, location.longitude], 15);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);

        L.circle([location.latitude, location.longitude], {
          radius: 1500, color: '#7C3AED', weight: 1.5,
          fillColor: '#8B5CF6', fillOpacity: 0.06,
        }).addTo(map);

        L.circleMarker([location.latitude, location.longitude], {
          radius: 9, color: '#fff', weight: 3,
          fillColor: '#4F46E5', fillOpacity: 1,
        }).addTo(map);

        layerRef.current = L.layerGroup().addTo(map);
        mapRef.current   = map;

        // Render bathrooms that arrived before the map was ready
        syncMarkers(L, bathroomsRef.current);
      });
    }).catch(() => {});

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current   = null;
      layerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.latitude, location?.longitude]);

  // ── Keep markers in sync with bathrooms prop ───────────────────────────────
  useEffect(() => {
    if (!window.L || !mapRef.current) return;
    syncMarkers(window.L, bathrooms);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bathrooms]);

  function syncMarkers(L, list) {
    if (!L || !layerRef.current) return;
    layerRef.current.clearLayers();
    elsRef.current = {};

    list.forEach((b) => {
      const el = document.createElement('div');
      el.className  = 'pf-ti';
      el.textContent = '🚽';
      elsRef.current[b.id] = el;

      L.marker([b.latitude, b.longitude], {
        icon: L.divIcon({ html: el, className: '', iconSize: [36, 36], iconAnchor: [18, 36] }),
      }).addTo(layerRef.current).on('click', () => {
        Object.values(elsRef.current).forEach((e) => e.classList.remove('sel'));
        el.classList.add('sel');
        onSelectRef.current(b);
      });
    });
  }

  const centerOnUser = useCallback(() => {
    if (mapRef.current && location) {
      mapRef.current.flyTo([location.latitude, location.longitude], 15, { duration: 0.5 });
    }
  }, [location]);

  if (!location) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/*
        nativeID maps to the HTML id attribute in React Native Web.
        Using getElementById in the effect is the only reliable way to get
        a real HTMLElement (View refs return component instances, not DOM nodes).
      */}
      <View nativeID={mapId} style={styles.map} />

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#7C3AED" />
          <Text style={styles.loadingOverlayText}>Finding bathrooms...</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.centerBtn}
        onPress={centerOnUser}
        accessibilityRole="button"
        accessibilityLabel="Center map on my location"
      >
        <Ionicons name="locate" size={22} color="#7C3AED" accessibilityElementsHidden />
      </TouchableOpacity>

      <View style={styles.countBadge}>
        <Text style={styles.countText}>
          {bathrooms.length} restroom{bathrooms.length !== 1 ? 's' : ''} nearby
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map:       { flex: 1 },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f4ff' },
  loadingText: { marginTop: 12, color: '#7C3AED', fontSize: 16, fontWeight: '600' },
  loadingOverlay: {
    position: 'absolute', top: 16, alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.93)',
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 4,
  },
  loadingOverlayText: { fontSize: 13, color: '#7C3AED', fontWeight: '600' },
  centerBtn: {
    position: 'absolute', bottom: 24, right: 16,
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 5,
  },
  countBadge: {
    position: 'absolute', bottom: 24, left: 16,
    backgroundColor: '#7C3AED', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  countText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
