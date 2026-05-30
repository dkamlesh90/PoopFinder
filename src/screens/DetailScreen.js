import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchFoursquareTips, fetchOSMNotesNear } from '../services/bathroomService';
import AdBanner from '../components/AdBanner';

const SOURCE_LABELS = {
  osm: 'OpenStreetMap',
  foursquare: 'Foursquare',
  refuge: 'Refuge',
  wikidata: 'Wikidata',
  city: 'City Data',
};

export default function DetailScreen({ bathroom, onBack }) {
  const [reviews, setReviews]           = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadReviews() {
      setReviewsLoading(true);
      const [tips, notes] = await Promise.all([
        bathroom.fsq_id ? fetchFoursquareTips(bathroom.fsq_id) : Promise.resolve([]),
        fetchOSMNotesNear(bathroom.latitude, bathroom.longitude, 200),
      ]);
      if (!cancelled) {
        setReviews([...tips, ...notes]);
        setReviewsLoading(false);
      }
    }
    loadReviews();
    return () => { cancelled = true; };
  }, [bathroom.fsq_id, bathroom.latitude, bathroom.longitude]);

  function openInMaps() {
    const { latitude, longitude, name } = bathroom;
    const label = encodeURIComponent(name);
    const url =
      Platform.OS === 'ios'
        ? `maps:?q=${label}&ll=${latitude},${longitude}`
        : `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`;
    Linking.openURL(url);
  }

  const stars = Math.round(bathroom.rating);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back to restroom list"
        >
          <Ionicons name="arrow-back" size={22} color="#7C3AED" accessibilityElementsHidden />
        </TouchableOpacity>
        <Text style={styles.headerTitle} accessibilityRole="header" numberOfLines={1}>
          Restroom Details
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View
          style={styles.heroCard}
          accessible
          accessibilityLabel={`${bathroom.name}, ${bathroom.distanceLabel} away, rated ${bathroom.rating} out of 5 stars${bathroom.ratingDetails?.length > 1 ? `, averaged from ${bathroom.ratingDetails.length} sources` : ''}`}
        >
          {bathroom.image ? (
            <Image source={{ uri: bathroom.image }} style={styles.heroImage} />
          ) : (
            <Text style={styles.heroEmoji} accessibilityElementsHidden>🚽</Text>
          )}
          <Text style={styles.heroName}>{bathroom.name}</Text>
          <View style={styles.starsRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {Array.from({ length: 5 }).map((_, i) => (
              <Ionicons key={i} name={i < stars ? 'star' : 'star-outline'} size={18} color="#B45309" />
            ))}
            <Text style={styles.ratingLabel}>{bathroom.rating} / 5.0</Text>
          </View>
          {bathroom.ratingDetails?.length > 1 && (
            <View style={styles.ratingSourcesRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {bathroom.ratingDetails.map((r, i) => (
                <View key={i} style={styles.ratingSourceChip}>
                  <Text style={styles.ratingSourceText}>{SOURCE_LABELS[r.source] ?? r.source}</Text>
                  <Text style={styles.ratingSourceScore}>{r.rating.toFixed(1)}</Text>
                </View>
              ))}
            </View>
          )}
          <Text style={styles.distanceLabel}>{bathroom.distanceLabel} away</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Details</Text>
          <InfoRow label="Entry Fee"              value={bathroom.fee ? 'Paid' : 'Free'}   valueColor={bathroom.fee ? '#991B1B' : '#166534'} />
          <InfoRow label="Wheelchair Accessible"  value={bathroom.accessible ? 'Yes' : 'No'} />
          <InfoRow label="Baby Changing Table"    value={bathroom.changingTable ? 'Yes' : 'No'} />
          <InfoRow
            label="Gender"
            value={
              bathroom.unisex
                ? 'Unisex'
                : [bathroom.male && 'Male', bathroom.female && 'Female'].filter(Boolean).join(' & ') || 'Unknown'
            }
          />
          {bathroom.openingHours && <InfoRow label="Hours" value={bathroom.openingHours} />}
          {bathroom.description && <InfoRow label="Notes" value={bathroom.description} />}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Poop Score</Text>
          <PoopScore bathroom={bathroom} />
        </View>

        <AdBanner />

        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Community Reviews</Text>
          {reviewsLoading ? (
            <View style={styles.reviewsLoading}>
              <ActivityIndicator size="small" color="#7C3AED" />
              <Text style={styles.reviewsLoadingText}>Loading reviews…</Text>
            </View>
          ) : reviews.length === 0 ? (
            <Text style={styles.noReviews}>No reviews yet for this location.</Text>
          ) : (
            reviews.map((r, i) => <ReviewRow key={i} review={r} />)
          )}
        </View>

        <TouchableOpacity
          style={styles.directionsBtn}
          onPress={openInMaps}
          accessibilityRole="button"
          accessibilityLabel={`Get directions to ${bathroom.name}`}
          accessibilityHint="Opens your maps app with directions"
        >
          <Ionicons name="navigate" size={20} color="#fff" accessibilityElementsHidden />
          <Text style={styles.directionsBtnText}>Get Directions</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function ReviewRow({ review }) {
  const isFSQ = review.source === 'foursquare';
  const date  = review.createdAt
    ? new Date(review.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : null;

  return (
    <View style={styles.reviewRow}>
      <View style={styles.reviewHeader}>
        <View style={[styles.reviewBadge, isFSQ ? styles.reviewBadgeFSQ : styles.reviewBadgeOSM]}>
          <Text style={styles.reviewBadgeText}>{isFSQ ? 'Foursquare' : 'OSM Note'}</Text>
        </View>
        {date && <Text style={styles.reviewDate}>{date}</Text>}
        {isFSQ && review.agreeCount > 0 && (
          <View style={styles.reviewAgree}>
            <Ionicons name="thumbs-up" size={11} color="#166534" />
            <Text style={styles.reviewAgreeText}>{review.agreeCount}</Text>
          </View>
        )}
      </View>
      <Text style={styles.reviewText}>{review.text}</Text>
    </View>
  );
}

function InfoRow({ label, value, valueColor }) {
  return (
    <View
      style={styles.infoRow}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

function PoopScore({ bathroom }) {
  let score = 50;
  const reasons = [];

  if (!bathroom.fee)                    { score += 20; reasons.push({ text: '+20 Free to use',    positive: true  }); }
  else                                  { score -= 15; reasons.push({ text: '-15 Costs money',    positive: false }); }
  if (bathroom.accessible)              { score += 10; reasons.push({ text: '+10 Accessible',     positive: true  }); }
  if (bathroom.changingTable)           { score += 5;  reasons.push({ text: '+5 Changing table',  positive: true  }); }
  if (bathroom.openingHours === '24/7') { score += 15; reasons.push({ text: '+15 Open 24/7',      positive: true  }); }
  if (bathroom.distance < 200)          { score += 15; reasons.push({ text: '+15 Very close',     positive: true  }); }
  else if (bathroom.distance < 500)     { score += 8;  reasons.push({ text: '+8 Nearby',          positive: true  }); }
  else if (bathroom.distance > 1000)    { score -= 10; reasons.push({ text: '-10 Far away',       positive: false }); }

  score = Math.max(0, Math.min(100, score));

  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Okay' : 'Poor';
  const color = score >= 80 ? '#166534' : score >= 60 ? '#1E40AF' : score >= 40 ? '#92400E' : '#991B1B';
  const emoji = score >= 80 ? '💩' : score >= 60 ? '👍' : score >= 40 ? '😐' : '👎';

  const reasonSummary = reasons.map((r) => r.text).join(', ');

  return (
    <View
      style={styles.poopScoreCard}
      accessible
      accessibilityLabel={`Poop score: ${score} out of 100, ${label}. Reasons: ${reasonSummary}`}
    >
      <View style={styles.scoreCircle} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={styles.scoreEmoji}>{emoji}</Text>
        <Text style={[styles.scoreNumber, { color }]}>{score}</Text>
        <Text style={[styles.scoreLabel, { color }]}>{label}</Text>
      </View>
      <View style={styles.scoreReasons} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {reasons.map((r, i) => (
          <Text key={i} style={[styles.reasonText, { color: r.positive ? '#166534' : '#991B1B' }]}>
            {r.text}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f4ff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0e8ff',
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#222', flex: 1, textAlign: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  heroEmoji: { fontSize: 56, marginBottom: 10 },
  heroImage: { width: '100%', height: 160, borderRadius: 12, marginBottom: 12, resizeMode: 'cover' },
  heroName: { fontSize: 20, fontWeight: '800', color: '#222', textAlign: 'center', marginBottom: 8 },
  starsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 3 },
  ratingLabel: { fontSize: 14, color: '#666', marginLeft: 6 },
  distanceLabel: { fontSize: 14, color: '#7C3AED', fontWeight: '600' },
  ratingSourcesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
  },
  ratingSourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef9ec',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#f5e4a0',
  },
  ratingSourceText: { fontSize: 10, color: '#78350F', fontWeight: '600' },
  ratingSourceScore: { fontSize: 10, color: '#B45309', fontWeight: '800' },
  section: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#7C3AED', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f0ff' },
  infoLabel: { flex: 1, fontSize: 14, color: '#444' },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#222' },
  poopScoreCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  scoreCircle: { alignItems: 'center', width: 80 },
  scoreEmoji: { fontSize: 32, marginBottom: 4 },
  scoreNumber: { fontSize: 28, fontWeight: '900' },
  scoreLabel: { fontSize: 12, fontWeight: '700' },
  scoreReasons: { flex: 1, gap: 4 },
  reasonText: { fontSize: 13, fontWeight: '600' },
  reviewsLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  reviewsLoadingText: { fontSize: 13, color: '#7C3AED' },
  noReviews: { fontSize: 13, color: '#888', fontStyle: 'italic' },
  reviewRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f0ff',
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  reviewBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  reviewBadgeFSQ: { backgroundColor: '#FFF0E0' },
  reviewBadgeOSM: { backgroundColor: '#E8F5E9' },
  reviewBadgeText: { fontSize: 10, fontWeight: '700', color: '#444' },
  reviewDate: { fontSize: 11, color: '#999', flex: 1 },
  reviewAgree: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  reviewAgreeText: { fontSize: 11, color: '#166534', fontWeight: '700' },
  reviewText: { fontSize: 14, color: '#333', lineHeight: 20 },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    paddingVertical: 16,
    minHeight: 44,
    gap: 10,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  directionsBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
