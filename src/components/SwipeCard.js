import React, { useRef } from 'react';
import {
  Animated,
  PanResponder,
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.30;
const SWIPE_OUT_DURATION = 280;

export default function SwipeCard({ bathroom, onSwipeLeft, onSwipeRight, isTop }) {
  const position = useRef(new Animated.ValueXY()).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isTop,
      onPanResponderMove: Animated.event(
        [null, { dx: position.x, dy: position.y }],
        { useNativeDriver: true }
      ),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) forceSwipe('right');
        else if (gesture.dx < -SWIPE_THRESHOLD) forceSwipe('left');
        else resetPosition();
      },
    })
  ).current;

  function forceSwipe(direction) {
    const x = direction === 'right' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;
    Animated.timing(position, {
      toValue: { x, y: 0 },
      duration: SWIPE_OUT_DURATION,
      useNativeDriver: true,
    }).start(() => {
      position.setValue({ x: 0, y: 0 });
      direction === 'right' ? onSwipeRight(bathroom) : onSwipeLeft(bathroom);
    });
  }

  function resetPosition() {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      friction: 5,
      useNativeDriver: true,
    }).start();
  }

  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ['-18deg', '0deg', '18deg'],
    extrapolate: 'clamp',
  });

  const yesOpacity = position.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const noOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const stars = Math.round(bathroom.rating);

  const features = [
    !bathroom.fee && 'free',
    bathroom.fee && 'paid entry',
    bathroom.accessible && 'wheelchair accessible',
    bathroom.changingTable && 'baby changing table',
    bathroom.openingHours === '24/7' && 'open 24 hours',
  ].filter(Boolean).join(', ');

  if (!isTop) {
    return (
      <View
        style={[styles.card, styles.cardBehind]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text style={styles.behindEmoji}>🚽</Text>
      </View>
    );
  }

  return (
    <Animated.View
      style={[styles.card, { transform: [...position.getTranslateTransform(), { rotate }] }]}
      {...panResponder.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`${bathroom.name}, ${bathroom.distanceLabel} away, rated ${bathroom.rating} out of 5. ${features}`}
      accessibilityHint="Swipe right to mark as Would Poop Here, swipe left for Hard Pass"
      accessibilityActions={[
        { name: 'increment', label: 'Would Poop Here' },
        { name: 'decrement', label: 'Hard Pass' },
      ]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'increment') onSwipeRight(bathroom);
        if (event.nativeEvent.actionName === 'decrement') onSwipeLeft(bathroom);
      }}
    >
      {/* Overlays are decorative — hidden from screen reader */}
      <Animated.View
        style={[styles.overlayLabel, styles.yesLabel, { opacity: yesOpacity }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text style={styles.yesText}>WOULD{'\n'}POOP</Text>
        <Text style={styles.overlayEmoji}>💩</Text>
      </Animated.View>

      <Animated.View
        style={[styles.overlayLabel, styles.noLabel, { opacity: noOpacity }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text style={styles.noText}>HARD{'\n'}PASS</Text>
        <Text style={styles.overlayEmoji}>🙅</Text>
      </Animated.View>

      {/* Card content — hidden individually since the parent Animated.View is the accessible element */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={styles.emojiContainer}>
          <Text style={styles.mainEmoji}>🚽</Text>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardName}>{bathroom.name}</Text>
          <Text style={styles.cardDistance}>{bathroom.distanceLabel} away</Text>

          <View style={styles.starsRow}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Ionicons key={i} name={i < stars ? 'star' : 'star-outline'} size={20} color="#B45309" />
            ))}
            <Text style={styles.ratingNum}>{bathroom.rating}</Text>
          </View>

          <View style={styles.chipRow}>
            {!bathroom.fee && <Chip icon="cash-outline" label="Free" color="#166534" />}
            {bathroom.fee && <Chip icon="cash" label="Paid" color="#991B1B" />}
            {bathroom.accessible && <Chip icon="accessibility" label="Accessible" color="#1E40AF" />}
            {bathroom.changingTable && <Chip icon="person" label="Baby Table" color="#6D28D9" />}
            {bathroom.openingHours === '24/7' && <Chip icon="time" label="24/7" color="#065F46" />}
          </View>

          {bathroom.openingHours && bathroom.openingHours !== '24/7' && (
            <View style={styles.hoursRow}>
              <Ionicons name="time-outline" size={14} color="#444" />
              <Text style={styles.hoursText}>{bathroom.openingHours}</Text>
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

function Chip({ icon, label, color }) {
  return (
    <View style={[styles.chip, { borderColor: color }]}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: SCREEN_WIDTH - 32,
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
    overflow: 'hidden',
  },
  cardBehind: {
    top: 10,
    transform: [{ scale: 0.95 }],
    backgroundColor: '#f0e9ff',
    justifyContent: 'center',
    alignItems: 'center',
    height: 420,
  },
  behindEmoji: { fontSize: 48, opacity: 0.3 },
  emojiContainer: {
    backgroundColor: '#f8f4ff',
    paddingVertical: 36,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0e8ff',
  },
  mainEmoji: { fontSize: 80 },
  cardBody: { padding: 20 },
  cardName: { fontSize: 22, fontWeight: '800', color: '#1a1a2e', marginBottom: 4 },
  cardDistance: { fontSize: 14, color: '#7C3AED', fontWeight: '600', marginBottom: 12 },
  starsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 3 },
  ratingNum: { fontSize: 14, color: '#666', marginLeft: 6, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 3,
  },
  chipText: { fontSize: 11, fontWeight: '700' },
  hoursRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  hoursText: { fontSize: 13, color: '#444' },
  overlayLabel: {
    position: 'absolute',
    top: 40,
    zIndex: 10,
    borderWidth: 4,
    borderRadius: 10,
    padding: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  yesLabel: {
    left: 20,
    borderColor: '#27ae60',
    backgroundColor: 'rgba(39,174,96,0.08)',
    transform: [{ rotate: '-15deg' }],
  },
  noLabel: {
    right: 20,
    borderColor: '#e74c3c',
    backgroundColor: 'rgba(231,76,60,0.08)',
    transform: [{ rotate: '15deg' }],
  },
  yesText: { fontSize: 20, fontWeight: '900', color: '#166534', textAlign: 'center', lineHeight: 22 },
  noText: { fontSize: 20, fontWeight: '900', color: '#991B1B', textAlign: 'center', lineHeight: 22 },
  overlayEmoji: { fontSize: 22, marginTop: 2 },
});
