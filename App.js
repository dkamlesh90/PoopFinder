import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { Ionicons } from '@expo/vector-icons';

import MapScreen from './src/screens/MapScreen';
import ListScreen from './src/screens/ListScreen';
import DetailScreen from './src/screens/DetailScreen';
import TinderScreen from './src/screens/TinderScreen';
import SplashScreen from './src/screens/SplashScreen';
import FilterModal, { DEFAULT_FILTERS, countActiveFilters, applyFilters } from './src/components/FilterModal';
import LocationPickerModal from './src/components/LocationPickerModal';
import { fetchNearbyBathrooms, loadCachedBathrooms, loadStaleCachedBathrooms, getMockBathrooms } from './src/services/bathroomService';
import { formatDistance } from './src/utils/geo';

ExpoSplashScreen.preventAutoHideAsync();

const TABS = [
  { key: 'map',    label: 'Map',    icon: 'map' },
  { key: 'list',   label: 'Nearby', icon: 'list' },
  { key: 'tinder', label: 'Rate',   icon: 'heart' },
];

export default function App() {
  const [showSplash, setShowSplash]             = useState(true);
  const [location, setLocation]                 = useState(null);
  const [bathrooms, setBathrooms]               = useState([]);
  const [loading, setLoading]                   = useState(false);
  const [fromCache, setFromCache]               = useState(false);
  const [fromMock, setFromMock]                 = useState(false);
  const [tab, setTab]                           = useState('map');
  const [selectedBathroom, setSelectedBathroom] = useState(null);
  const [locationError, setLocationError]       = useState(null);
  const [filters, setFilters]                   = useState(DEFAULT_FILTERS);
  const [filterVisible, setFilterVisible]       = useState(false);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [locationName, setLocationName]         = useState(null);
  // Track the radius (metres) of the last completed fetch so we only re-fetch
  // when the user selects a distance larger than what we already have.
  const lastFetchedRadiusRef = useRef(DEFAULT_FILTERS.maxDistanceMi * 1609.344);

  const loadBathrooms = useCallback(async (coords, radiusMeters = DEFAULT_FILTERS.maxDistanceMi * 1609.344) => {
    setLoading(true);
    try {
      const results = await fetchNearbyBathrooms(coords.latitude, coords.longitude, radiusMeters);
      lastFetchedRadiusRef.current = radiusMeters;
      setBathrooms(results);
      setFromCache(false);
      setFromMock(false);
    } catch {
      // 1. Try fresh cache (same location, within TTL)
      // 2. Fall back to any stored cache regardless of age — real data beats demo data
      // 3. Last resort: built-in offline demo data
      const cached =
        (await loadCachedBathrooms(coords.latitude, coords.longitude)) ??
        (await loadStaleCachedBathrooms());
      if (cached) {
        setBathrooms(cached);
        setFromCache(true);
        setFromMock(false);
      } else {
        setBathrooms(getMockBathrooms(coords.latitude, coords.longitude));
        setFromMock(true);
        setFromCache(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const requestLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocationError('Location permission denied. Please enable it in Settings.');
      return;
    }
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };

      // Show cached data immediately, then refresh in background
      const cached = await loadCachedBathrooms(coords.latitude, coords.longitude);
      if (cached) {
        setBathrooms(cached);
        setFromCache(true);
      }

      setLocation(coords);
      loadBathrooms(coords);
    } catch {
      setLocationError('Could not get your location. Please try again.');
    }
  }, [loadBathrooms]);

  const handlePickLocation = useCallback(({ latitude, longitude, name }) => {
    const coords = { latitude, longitude };
    // Clear immediately so the map doesn't show stale markers at the new location
    setBathrooms([]);
    setFromCache(false);
    setFromMock(false);
    setLocation(coords);
    setLocationName(name);
    setLocationPickerVisible(false);
    lastFetchedRadiusRef.current = 0;
    loadBathrooms(coords, filters.maxDistanceMi * 1609.344);
  }, [loadBathrooms, filters.maxDistanceMi]);

  const handleUseGPS = useCallback(() => {
    setBathrooms([]);
    setFromCache(false);
    setFromMock(false);
    setLocationPickerVisible(false);
    setLocationName(null);
    lastFetchedRadiusRef.current = 0;
    requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    ExpoSplashScreen.hideAsync();
    requestLocation();
  }, [requestLocation]);

  const filteredBathrooms = useMemo(() => {
    const filtered = applyFilters(bathrooms, filters);
    if (!filters.useKm) return filtered;
    // Reformat distance labels when the user has chosen km
    return filtered.map((b) => ({
      ...b,
      distanceLabel: formatDistance(b.distance, true),
    }));
  }, [bathrooms, filters]);

  const activeFilterCount = countActiveFilters(filters);

  const handleSplashFinish        = useCallback(() => setShowSplash(false), []);
  const handleCloseFilters        = useCallback(() => setFilterVisible(false), []);
  const handleCloseLocationPicker = useCallback(() => setLocationPickerVisible(false), []);
  const handleBack                = useCallback(() => setSelectedBathroom(null), []);
  const handleViewOnMap           = useCallback(() => { setSelectedBathroom(null); setTab('map'); }, []);
  const handleApplyFilters     = useCallback((f) => {
    setFilters(f);
    setFilterVisible(false);
    const newRadiusM = f.maxDistanceMi * 1609.344;
    if (location && newRadiusM > lastFetchedRadiusRef.current) {
      loadBathrooms(location, newRadiusM);
    }
  }, [location, loadBathrooms]);

  // Panic mode: open directions to the best available bathroom immediately
  const handlePanic = useCallback(() => {
    const pool = filteredBathrooms.length > 0 ? filteredBathrooms : bathrooms;
    if (pool.length === 0) {
      Alert.alert('No restrooms loaded', 'Please wait for restrooms to load, then try again.');
      return;
    }
    // Prefer the closest free one; fall back to just closest
    const best = pool.find((b) => !b.fee) ?? pool[0];
    const { latitude, longitude, name } = best;
    const label = encodeURIComponent(name);
    const url =
      Platform.OS === 'ios'
        ? `maps:?q=${label}&ll=${latitude},${longitude}`
        : `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`;
    Linking.openURL(url);
  }, [filteredBathrooms, bathrooms]);

  if (locationError) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorEmoji} accessibilityElementsHidden>📍</Text>
        <Text style={styles.errorTitle} accessibilityRole="header">Location Required</Text>
        <Text style={styles.errorText}>{locationError}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={requestLocation}
          accessibilityRole="button"
          accessibilityLabel="Try again to get location"
        >
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {selectedBathroom ? (
        <DetailScreen
          bathroom={selectedBathroom}
          onBack={handleBack}
          onViewOnMap={handleViewOnMap}
        />
      ) : (
        <View style={styles.flex}>
          <View style={styles.appHeader}>
            <TouchableOpacity
              style={styles.logoRow}
              onPress={() => setLocationPickerVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={`Change location. Currently ${locationName ?? 'using GPS'}`}
            >
              <View style={styles.logoMark}>
                <Text style={styles.logoMarkEmoji}>🚽</Text>
              </View>
              <View style={styles.logoText}>
                <Text style={styles.appTitle} accessibilityRole="header">Poop Finder</Text>
                <View style={styles.subtitleRow}>
                  <Ionicons name={locationName ? 'location' : 'navigate'} size={11} color="#7C3AED" />
                  <Text style={styles.appSubtitle} numberOfLines={1}>
                    {locationName
                      ? locationName
                      : fromMock
                      ? '📱 Offline — demo data'
                      : fromCache
                      ? '📦 Cached results'
                      : 'GPS — tap to change'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            <View style={styles.headerActions}>
              {/* Location picker button */}
              <TouchableOpacity
                onPress={() => setLocationPickerVisible(true)}
                style={[styles.locationBtn, locationName && styles.locationBtnActive]}
                accessibilityRole="button"
                accessibilityLabel="Change search location"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="location-outline" size={22} color={locationName ? '#fff' : '#7C3AED'} />
              </TouchableOpacity>

              {/* Panic button */}
              <TouchableOpacity
                onPress={handlePanic}
                style={styles.panicBtn}
                disabled={bathrooms.length === 0}
                accessibilityRole="button"
                accessibilityLabel="Panic mode — get directions to nearest free restroom"
                accessibilityState={{ disabled: bathrooms.length === 0 }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.panicBtnText}>🚨</Text>
              </TouchableOpacity>

              {/* Filter button */}
              <TouchableOpacity
                onPress={() => setFilterVisible(true)}
                style={styles.filterBtn}
                accessibilityRole="button"
                accessibilityLabel={`Filters${activeFilterCount > 0 ? `, ${activeFilterCount} active` : ''}`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="options-outline" size={22} color="#7C3AED" />
                {activeFilterCount > 0 && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Refresh button */}
              <TouchableOpacity
                onPress={() => location && loadBathrooms(location, filters.maxDistanceMi * 1609.344)}
                style={styles.refreshBtn}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Refresh nearby restrooms"
                accessibilityState={{ disabled: loading }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="refresh" size={22} color={loading ? '#aaa' : '#7C3AED'} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.flex}>
            {/* Keep all three screens mounted — hiding vs unmounting avoids
                re-initialising Leaflet/WebView on every tab switch */}
            <View style={[styles.flex, tab !== 'map' && styles.hidden]} pointerEvents={tab !== 'map' ? 'none' : 'auto'}>
              <MapScreen
                location={location}
                bathrooms={filteredBathrooms}
                loading={loading}
                onSelectBathroom={setSelectedBathroom}
                radiusMeters={filters.maxDistanceMi * 1609.344}
              />
            </View>
            <View style={[styles.flex, tab !== 'list' && styles.hidden]} pointerEvents={tab !== 'list' ? 'none' : 'auto'}>
              <ListScreen
                bathrooms={filteredBathrooms}
                loading={loading}
                onSelectBathroom={setSelectedBathroom}
              />
            </View>
            <View style={[styles.flex, tab !== 'tinder' && styles.hidden]} pointerEvents={tab !== 'tinder' ? 'none' : 'auto'}>
              <TinderScreen bathrooms={filteredBathrooms} loading={loading} />
            </View>
          </View>

          <View style={styles.tabBar} accessibilityRole="tablist">
            {TABS.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={styles.tabItem}
                onPress={() => setTab(t.key)}
                accessibilityRole="tab"
                accessibilityLabel={t.label}
                accessibilityState={{ selected: tab === t.key }}
              >
                <Ionicons
                  name={tab === t.key ? t.icon : `${t.icon}-outline`}
                  size={24}
                  color={tab === t.key ? '#7C3AED' : '#767676'}
                  accessibilityElementsHidden
                />
                <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <LocationPickerModal
        visible={locationPickerVisible}
        currentName={locationName}
        onSelect={handlePickLocation}
        onUseGPS={handleUseGPS}
        onClose={handleCloseLocationPicker}
      />

      <FilterModal
        visible={filterVisible}
        filters={filters}
        onApply={handleApplyFilters}
        onClose={handleCloseFilters}
      />

      {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  hidden: { display: 'none' },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0e8ff',
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  logoText: { flex: 1, minWidth: 0 },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  logoMark: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#7C3AED',
    alignItems: 'center', justifyContent: 'center',
  },
  logoMarkEmoji: { fontSize: 20 },
  appTitle: { fontSize: 22, fontWeight: '900', color: '#222', letterSpacing: -0.5 },
  appSubtitle: { fontSize: 12, color: '#7C3AED', fontWeight: '500', flexShrink: 1 },
  locationBtn: {
    padding: 10, minWidth: 44, minHeight: 44,
    justifyContent: 'center', alignItems: 'center',
    borderRadius: 12,
  },
  locationBtnActive: {
    backgroundColor: '#7C3AED',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  panicBtn: {
    width: 44, height: 44,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#fff1f0',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#fca5a5',
  },
  panicBtnText: { fontSize: 20 },
  filterBtn: {
    padding: 10, minWidth: 44, minHeight: 44,
    justifyContent: 'center', alignItems: 'center',
  },
  filterBadge: {
    position: 'absolute', top: 6, right: 6,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#7C3AED',
    alignItems: 'center', justifyContent: 'center',
  },
  filterBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  refreshBtn: { padding: 11, minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f0e8ff',
    backgroundColor: '#fff',
  },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 10, minHeight: 44, justifyContent: 'center', gap: 2 },
  tabLabel: { fontSize: 11, color: '#767676', fontWeight: '600' },
  tabLabelActive: { color: '#7C3AED' },
  errorContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#f8f4ff', padding: 32,
  },
  errorEmoji: { fontSize: 64, marginBottom: 16 },
  errorTitle: { fontSize: 22, fontWeight: '800', color: '#222', marginBottom: 10 },
  errorText: { fontSize: 15, color: '#444', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  retryBtn: { backgroundColor: '#7C3AED', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, minHeight: 44, justifyContent: 'center' },
  retryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
