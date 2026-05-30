import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BathroomCard from '../components/BathroomCard';
import AdBanner from '../components/AdBanner';
import { useFavorites } from '../hooks/useFavorites';

const AD_INTERVAL = 5;
const TABS = [
  { key: 'all',       label: 'All',       icon: 'list-outline' },
  { key: 'favorites', label: 'Favorites', icon: 'heart-outline' },
];

const SORT_OPTIONS = [
  { key: 'distance', icon: 'navigate-outline', label: 'Nearest' },
  { key: 'rating',   icon: 'star-outline',     label: 'Top Rated' },
];

export default function ListScreen({ bathrooms, loading, onSelectBathroom }) {
  const [search, setSearch]       = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [sortBy, setSortBy]       = useState('distance');
  const { isFavorite, toggleFavorite } = useFavorites();

  const filtered = useMemo(() => {
    const pool = activeTab === 'favorites'
      ? bathrooms.filter((b) => isFavorite(b.id))
      : bathrooms;
    const lowerSearch = search.toLowerCase();
    const matched = lowerSearch
      ? pool.filter((b) => b.name.toLowerCase().includes(lowerSearch))
      : pool;
    if (sortBy === 'rating') {
      return [...matched].sort((a, b) => b.rating - a.rating);
    }
    // 'distance' — already sorted by service
    return matched;
  }, [bathrooms, search, activeTab, isFavorite, sortBy]);

  // Weave an ad placeholder after every AD_INTERVAL bathroom items
  const listData = useMemo(() => {
    const result = [];
    filtered.forEach((item, index) => {
      result.push(item);
      if ((index + 1) % AD_INTERVAL === 0) {
        result.push({ _isAd: true, id: `__ad_${index}` });
      }
    });
    return result;
  }, [filtered]);

  const renderItem = useCallback(({ item }) => {
    if (item._isAd) return <AdBanner />;
    return (
      <BathroomCard
        bathroom={item}
        onPress={() => onSelectBathroom(item)}
        isFavorite={isFavorite(item.id)}
        onToggleFavorite={toggleFavorite}
      />
    );
  }, [onSelectBathroom, isFavorite, toggleFavorite]);

  const keyExtractor = useCallback((item) => item.id, []);

  const emptyMessage = useMemo(() => {
    if (activeTab === 'favorites') return 'Tap the heart on any restroom to save it here.';
    return search ? 'Try a different search term' : 'Try adjusting your filters or refreshing';
  }, [activeTab, search]);

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#767676" style={styles.searchIcon} accessibilityElementsHidden />
        <TextInput
          style={styles.searchInput}
          placeholder="Search restrooms..."
          placeholderTextColor="#767676"
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
          accessibilityLabel="Search restrooms"
          accessibilityHint="Type to filter the list of nearby restrooms"
          returnKeyType="search"
        />
      </View>

      <View style={styles.tabRow} accessibilityRole="tablist">
        {TABS.map((t) => {
          const active = activeTab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setActiveTab(t.key)}
              accessibilityRole="tab"
              accessibilityLabel={t.label}
              accessibilityState={{ selected: active }}
            >
              <Ionicons
                name={active ? t.icon.replace('-outline', '') : t.icon}
                size={14}
                color={active ? '#fff' : '#7C3AED'}
                accessibilityElementsHidden
              />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {!loading && bathrooms.length > 0 && (
        <View style={styles.sortRow} accessibilityRole="radiogroup" accessibilityLabel="Sort by">
          {SORT_OPTIONS.map((opt) => {
            const active = sortBy === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.sortBtn, active && styles.sortBtnActive]}
                onPress={() => setSortBy(opt.key)}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={opt.label}
              >
                <Ionicons
                  name={active ? opt.icon.replace('-outline', '') : opt.icon}
                  size={12}
                  color={active ? '#7C3AED' : '#999'}
                  accessibilityElementsHidden
                />
                <Text style={[styles.sortBtnText, active && styles.sortBtnTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {loading ? (
        <View accessibilityLiveRegion="polite" accessibilityLabel="Loading nearby restrooms">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji} accessibilityElementsHidden>
            {activeTab === 'favorites' ? '💜' : '🚫🚽'}
          </Text>
          <Text style={styles.emptyTitle} accessibilityRole="header">
            {activeTab === 'favorites' ? 'No favorites yet' : 'No restrooms found'}
          </Text>
          <Text style={styles.emptySubtitle}>{emptyMessage}</Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          accessibilityLabel={`${filtered.length} nearby restrooms`}
        />
      )}
    </View>
  );
}

function SkeletonCard() {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View style={[styles.skeletonCard, { opacity: pulse }]} accessibilityElementsHidden>
      <View style={styles.skeletonIcon} />
      <View style={styles.skeletonBody}>
        <View style={[styles.skeletonLine, { width: '70%' }]} />
        <View style={[styles.skeletonLine, { width: '45%', marginTop: 6 }]} />
        <View style={[styles.skeletonLine, { width: '55%', marginTop: 6 }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f4ff' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 44, fontSize: 15, color: '#222' },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 4,
    backgroundColor: '#f3efff',
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    borderRadius: 8,
  },
  tabActive: { backgroundColor: '#7C3AED' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#7C3AED' },
  tabTextActive: { color: '#fff' },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e8e0f7',
    backgroundColor: '#fff',
  },
  sortBtnActive: { borderColor: '#7C3AED', backgroundColor: '#f3eeff' },
  sortBtnText: { fontSize: 11, fontWeight: '600', color: '#999' },
  sortBtnTextActive: { color: '#7C3AED' },
  list: { paddingBottom: 24, paddingTop: 4 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: '#444', textAlign: 'center', lineHeight: 20 },
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 6,
    gap: 12,
  },
  skeletonIcon: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#e8e0f7',
  },
  skeletonBody: { flex: 1, gap: 0 },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e8e0f7',
  },
});
