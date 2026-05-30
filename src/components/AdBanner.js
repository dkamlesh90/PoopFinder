import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

// ── Configure your ad IDs here ────────────────────────────────────────────────
// Web (Google AdSense): replace with your publisher ID and ad slot
const ADSENSE_CLIENT = 'ca-pub-XXXXXXXXXXXXXXXX';
const ADSENSE_SLOT   = 'XXXXXXXXXX';

// Mobile (Google AdMob): replace with your banner unit IDs, then swap the
// AdBannerNative component below for BannerAd from react-native-google-mobile-ads.
// Setup: npx expo install react-native-google-mobile-ads  →  eas build
// const ADMOB_UNIT_ID = Platform.OS === 'ios'
//   ? 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX'
//   : 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX';
// ─────────────────────────────────────────────────────────────────────────────

// ── Web: inject AdSense ins element into a View via nativeID ─────────────────
function AdBannerWeb() {
  const id = useRef(`pf-ad-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    if (!document.querySelector('script[data-pf-adsense]')) {
      const s = document.createElement('script');
      s.async = true;
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
      s.crossOrigin = 'anonymous';
      s.setAttribute('data-pf-adsense', '1');
      document.head.appendChild(s);
    }

    const container = document.getElementById(id);
    if (!container) return;

    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.cssText = 'display:block;width:100%;';
    ins.setAttribute('data-ad-client', ADSENSE_CLIENT);
    ins.setAttribute('data-ad-slot', ADSENSE_SLOT);
    ins.setAttribute('data-ad-format', 'auto');
    ins.setAttribute('data-full-width-responsive', 'true');
    container.appendChild(ins);

    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
  }, [id]);

  return (
    <View style={styles.webWrapper} accessibilityLabel="Advertisement">
      <Text style={styles.adLabel}>Ad</Text>
      <View nativeID={id} style={styles.webSlot} />
    </View>
  );
}

// ── Mobile: placeholder until AdMob unit IDs are configured ──────────────────
function AdBannerNative() {
  return (
    <View style={styles.nativePlaceholder} accessibilityLabel="Advertisement">
      <Text style={styles.adLabel}>Ad</Text>
      <Text style={styles.nativeText}>Banner ad · configure AdMob unit ID to activate</Text>
    </View>
  );
}

export default function AdBanner() {
  if (Platform.OS === 'web') return <AdBannerWeb />;
  return <AdBannerNative />;
}

const styles = StyleSheet.create({
  adLabel: {
    fontSize: 9,
    color: '#aaa',
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    position: 'absolute',
    top: 4,
    right: 8,
  },
  webWrapper: {
    marginHorizontal: 16,
    marginVertical: 6,
    minHeight: 90,
    backgroundColor: '#fafafa',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e8e0f7',
    overflow: 'hidden',
  },
  webSlot: { width: '100%', minHeight: 90 },
  nativePlaceholder: {
    marginHorizontal: 16,
    marginVertical: 6,
    height: 60,
    backgroundColor: '#fafafa',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e8e0f7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nativeText: { fontSize: 11, color: '#bbb', marginTop: 2 },
});
