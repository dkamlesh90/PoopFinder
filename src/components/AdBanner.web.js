import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ADSENSE_CLIENT = 'ca-pub-XXXXXXXXXXXXXXXX';
const ADSENSE_SLOT   = 'XXXXXXXXXX';

export default function AdBanner() {
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
    <View style={styles.wrapper} accessibilityLabel="Advertisement">
      <Text style={styles.label}>Ad</Text>
      <View nativeID={id} style={styles.slot} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginVertical: 6,
    minHeight: 90,
    backgroundColor: '#fafafa',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e8e0f7',
    overflow: 'hidden',
  },
  slot: { width: '100%', minHeight: 90 },
  label: {
    fontSize: 9,
    color: '#aaa',
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    position: 'absolute',
    top: 4,
    right: 8,
  },
});
