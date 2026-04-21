import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export default function SplashScreen({ onFinish }) {
  const emojiScale   = useRef(new Animated.Value(0)).current;
  const emojiOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY       = useRef(new Animated.Value(20)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    function bounceDot(dot) {
      return Animated.sequence([
        Animated.timing(dot, { toValue: -10, duration: 250, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]);
    }

    // 1. Emoji bounces in
    Animated.spring(emojiScale, {
      toValue: 1,
      friction: 4,
      tension: 80,
      useNativeDriver: true,
    }).start();

    Animated.timing(emojiOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // 2. Title slides up after emoji
    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(titleY, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();

    // 3. Subtitle fades in
    Animated.sequence([
      Animated.delay(600),
      Animated.timing(subtitleOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    // 4. Loading dots stagger in and loop
    Animated.sequence([
      Animated.delay(800),
      Animated.loop(
        Animated.stagger(180, [bounceDot(dot1), bounceDot(dot2), bounceDot(dot3)])
      ),
    ]).start();

    // 5. Fade out and call onFinish after minimum display time
    Animated.sequence([
      Animated.delay(2200),
      Animated.timing(screenOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => onFinish());
  }, [onFinish, emojiScale, emojiOpacity, titleOpacity, titleY, subtitleOpacity, dot1, dot2, dot3, screenOpacity]);

  return (
    <Animated.View
      style={[styles.container, { opacity: screenOpacity }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Background circles for depth */}
      <View style={[styles.circle, styles.circleOuter]} />
      <View style={[styles.circle, styles.circleInner]} />

      {/* Emoji */}
      <Animated.Text
        style={[
          styles.emoji,
          { opacity: emojiOpacity, transform: [{ scale: emojiScale }] },
        ]}
      >
        🚽
      </Animated.Text>

      {/* App name */}
      <Animated.Text
        style={[
          styles.title,
          { opacity: titleOpacity, transform: [{ translateY: titleY }] },
        ]}
      >
        Poop Finder
      </Animated.Text>

      {/* Tagline */}
      <Animated.Text style={[styles.subtitle, { opacity: subtitleOpacity }]}>
        Finding your throne nearby 👑
      </Animated.Text>

      {/* Loading dots */}
      <Animated.View style={[styles.dotsRow, { opacity: subtitleOpacity }]}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View
            key={i}
            style={[styles.dot, { transform: [{ translateY: dot }] }]}
          />
        ))}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  circle: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  circleOuter: {
    width: width * 1.1,
    height: width * 1.1,
    top: -width * 0.35,
  },
  circleInner: {
    width: width * 0.7,
    height: width * 0.7,
    bottom: -width * 0.15,
    right: -width * 0.1,
  },
  emoji: {
    fontSize: 90,
    marginBottom: 24,
  },
  title: {
    fontSize: 40,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -1,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
    marginBottom: 48,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 10,
    position: 'absolute',
    bottom: 80,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
});
