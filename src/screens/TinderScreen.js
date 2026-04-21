import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import SwipeCard from '../components/SwipeCard';

const RATINGS_KEY = '@poopfinder_ratings';

// Stable empty callbacks so the behind-card never triggers re-renders
const noop = () => {};

export default function TinderScreen({ bathrooms, loading }) {
  const [queue, setQueue]           = useState([]);
  const [ratings, setRatings]       = useState({});
  const [showSummary, setShowSummary] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    async function init() {
      try {
        const stored = await AsyncStorage.getItem(RATINGS_KEY);
        const saved = stored ? JSON.parse(stored) : {};
        setRatings(saved);
        const unrated = bathrooms.filter((b) => !saved[b.id]);
        setQueue(unrated);
        setShowSummary(unrated.length === 0 && bathrooms.length > 0);
      } catch {
        setQueue(bathrooms);
      }
    }
    if (bathrooms.length > 0) init();
  }, [bathrooms]);

  const saveRating = useCallback(async (bathroom, verdict) => {
    setRatings((prev) => {
      const updated = { ...prev, [bathroom.id]: verdict };
      AsyncStorage.setItem(RATINGS_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const advanceQueue = useCallback(() => {
    setQueue((prev) => {
      const next = prev.slice(1);
      if (next.length === 0) setShowSummary(true);
      return next;
    });
  }, []);

  const handleSwipeRight = useCallback((bathroom) => {
    saveRating(bathroom, 'yes');
    advanceQueue();
  }, [saveRating, advanceQueue]);

  const handleSwipeLeft = useCallback((bathroom) => {
    saveRating(bathroom, 'no');
    advanceQueue();
  }, [saveRating, advanceQueue]);

  const handleReset = useCallback(() => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(
      async () => {
        await AsyncStorage.removeItem(RATINGS_KEY);
        setRatings({});
        setQueue(bathrooms);
        setShowSummary(false);
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      }
    );
  }, [fadeAnim, bathrooms]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>Loading bathrooms to rate...</Text>
      </View>
    );
  }

  if (bathrooms.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyEmoji}>🗺️</Text>
        <Text style={styles.emptyTitle}>No bathrooms found</Text>
        <Text style={styles.emptySubtitle}>Head to the Map tab and refresh to find some.</Text>
      </View>
    );
  }

  if (showSummary) {
    return <Summary ratings={ratings} bathrooms={bathrooms} onReset={handleReset} fadeAnim={fadeAnim} />;
  }

  const topCard = queue[0];
  const nextCard = queue[1];
  const progress = bathrooms.length - queue.length;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>{progress} / {bathrooms.length} rated</Text>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${(progress / bathrooms.length) * 100}%` }]} />
        </View>
      </View>

      <View style={styles.cardArea}>
        {nextCard && (
          <SwipeCard
            key={nextCard.id + '_behind'}
            bathroom={nextCard}
            isTop={false}
            onSwipeLeft={noop}
            onSwipeRight={noop}
          />
        )}
        {topCard && (
          <SwipeCard
            key={topCard.id}
            bathroom={topCard}
            isTop
            onSwipeLeft={handleSwipeLeft}
            onSwipeRight={handleSwipeRight}
          />
        )}
      </View>

      <View style={styles.hint}>
        <Text style={styles.hintText}>← Swipe to rate →</Text>
      </View>

      <View style={styles.actionRow}>
        <ActionButton icon="close"   color="#991B1B" bg="#fdf0ef" label="Pass"       onPress={() => handleSwipeLeft(topCard)} />
        <ActionButton icon="heart"   color="#166534" bg="#edfbf3" label="Would Poop" onPress={() => handleSwipeRight(topCard)} large />
        <ActionButton icon="refresh" color="#6D28D9" bg="#f3efff" label="Skip"       onPress={advanceQueue} />
      </View>
    </Animated.View>
  );
}

const ActionButton = memo(({ icon, color, bg, label, onPress, large }) => (
  <TouchableOpacity
    onPress={onPress}
    style={styles.actionBtnOuter}
    activeOpacity={0.8}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <View style={[styles.actionBtn, { backgroundColor: bg }, large && styles.actionBtnLarge]}>
      <Ionicons name={icon} size={large ? 34 : 26} color={color} />
    </View>
    <Text style={[styles.actionLabel, { color }]}>{label}</Text>
  </TouchableOpacity>
));

const Summary = memo(({ ratings, bathrooms, onReset, fadeAnim }) => {
  const { yeses, nos, best } = useMemo(() => {
    const yeses = bathrooms.filter((b) => ratings[b.id] === 'yes');
    const nos   = bathrooms.filter((b) => ratings[b.id] === 'no');
    const best  = [...yeses].sort((a, b) => a.distance - b.distance)[0];
    return { yeses, nos, best };
  }, [ratings, bathrooms]);

  return (
    <Animated.ScrollView style={{ flex: 1, opacity: fadeAnim }} contentContainerStyle={styles.summaryContent}>
      <Text style={styles.summaryTitle}>Your Poop Report 💩</Text>
      <Text style={styles.summarySubtitle}>
        You'd use <Text style={styles.greenBold}>{yeses.length}</Text> and skipped{' '}
        <Text style={styles.redBold}>{nos.length}</Text> restrooms.
      </Text>

      {best && (
        <View style={styles.bestCard}>
          <Text style={styles.bestLabel}>Best Pick Nearby</Text>
          <Text style={styles.bestEmoji}>🏆🚽</Text>
          <Text style={styles.bestName}>{best.name}</Text>
          <Text style={styles.bestDist}>{best.distanceLabel} away</Text>
          <View style={styles.bestMeta}>
            {!best.fee && <MetaBadge icon="cash-outline" label="Free" color="#166534" />}
            {best.accessible && <MetaBadge icon="accessibility" label="Accessible" color="#1E40AF" />}
            {best.openingHours === '24/7' && <MetaBadge icon="time" label="24/7" color="#065F46" />}
          </View>
        </View>
      )}

      {yeses.length > 0 && (
        <View style={styles.summarySection}>
          <Text style={styles.sectionHeader}>Would Poop Here ({yeses.length})</Text>
          {yeses.map((b) => <SummaryRow key={b.id} bathroom={b} verdict="yes" />)}
        </View>
      )}

      {nos.length > 0 && (
        <View style={styles.summarySection}>
          <Text style={styles.sectionHeader}>Hard Pass ({nos.length})</Text>
          {nos.map((b) => <SummaryRow key={b.id} bathroom={b} verdict="no" />)}
        </View>
      )}

      <TouchableOpacity
        style={styles.resetBtn}
        onPress={onReset}
        accessibilityRole="button"
        accessibilityLabel="Rate again — clear all ratings and start over"
      >
        <Ionicons name="refresh" size={18} color="#fff" accessibilityElementsHidden />
        <Text style={styles.resetBtnText}>Rate Again</Text>
      </TouchableOpacity>
    </Animated.ScrollView>
  );
});

const SummaryRow = memo(({ bathroom, verdict }) => (
  <View style={styles.summaryRow}>
    <Text style={styles.summaryRowEmoji}>{verdict === 'yes' ? '💩' : '🙅'}</Text>
    <View style={{ flex: 1 }}>
      <Text style={styles.summaryRowName} numberOfLines={1}>{bathroom.name}</Text>
      <Text style={styles.summaryRowDist}>{bathroom.distanceLabel}</Text>
    </View>
  </View>
));

const MetaBadge = memo(({ icon, label, color }) => (
  <View style={[styles.metaBadge, { borderColor: color }]}>
    <Ionicons name={icon} size={12} color={color} />
    <Text style={[styles.metaBadgeText, { color }]}>{label}</Text>
  </View>
));

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f4ff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f4ff', padding: 32 },
  loadingText: { marginTop: 12, color: '#7C3AED', fontSize: 16, fontWeight: '600' },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#222', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#666', textAlign: 'center' },
  progressRow: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 4 },
  progressText: { fontSize: 12, color: '#7C3AED', fontWeight: '700', marginBottom: 6, textAlign: 'right' },
  progressBarBg: { height: 5, backgroundColor: '#e8deff', borderRadius: 4 },
  progressBarFill: { height: 5, backgroundColor: '#7C3AED', borderRadius: 4 },
  cardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 4 },
  hint: { alignItems: 'center', paddingBottom: 6 },
  hintText: { fontSize: 12, color: '#767676', fontWeight: '600', letterSpacing: 1 },
  actionRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingBottom: 24, paddingTop: 8, gap: 20 },
  actionBtnOuter: { alignItems: 'center', gap: 4 },
  actionBtn: {
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 4,
  },
  actionBtnLarge: { width: 72, height: 72, borderRadius: 36 },
  actionLabel: { fontSize: 11, fontWeight: '700' },
  summaryContent: { padding: 20, paddingBottom: 40 },
  summaryTitle: { fontSize: 26, fontWeight: '900', color: '#1a1a2e', textAlign: 'center', marginBottom: 6 },
  summarySubtitle: { fontSize: 15, color: '#444', textAlign: 'center', marginBottom: 20 },
  greenBold: { color: '#166534', fontWeight: '800' },
  redBold: { color: '#991B1B', fontWeight: '800' },
  bestCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 20, alignItems: 'center', marginBottom: 20,
    borderWidth: 2, borderColor: '#7C3AED',
    shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 5,
  },
  bestLabel: { fontSize: 11, fontWeight: '800', color: '#7C3AED', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  bestEmoji: { fontSize: 44, marginBottom: 8 },
  bestName: { fontSize: 18, fontWeight: '800', color: '#1a1a2e', textAlign: 'center', marginBottom: 4 },
  bestDist: { fontSize: 14, color: '#7C3AED', fontWeight: '600', marginBottom: 10 },
  bestMeta: { flexDirection: 'row', gap: 6 },
  metaBadge: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, gap: 3 },
  metaBadgeText: { fontSize: 11, fontWeight: '700' },
  summarySection: { marginBottom: 16 },
  sectionHeader: { fontSize: 13, fontWeight: '800', color: '#7C3AED', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, padding: 12, marginBottom: 6, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  summaryRowEmoji: { fontSize: 24 },
  summaryRowName: { fontSize: 14, fontWeight: '700', color: '#222' },
  summaryRowDist: { fontSize: 12, color: '#666', marginTop: 1 },
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#7C3AED', borderRadius: 14, paddingVertical: 16, minHeight: 44, gap: 8, marginTop: 8,
    shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  resetBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
