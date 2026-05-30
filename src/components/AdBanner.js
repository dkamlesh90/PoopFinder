import { View, Text, StyleSheet, Platform } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';

// Replace with your real AdMob unit IDs from https://admob.google.com before publishing.
// Currently using Google's official test IDs.
const ADMOB_UNIT_ID = Platform.OS === 'ios'
  ? 'ca-app-pub-3940256099942544/2934735716'   // iOS test banner
  : 'ca-app-pub-3940256099942544/6300978111';  // Android test banner

export default function AdBanner() {
  return (
    <View style={styles.wrapper} accessibilityLabel="Advertisement">
      <Text style={styles.label}>Ad</Text>
      <BannerAd
        unitId={ADMOB_UNIT_ID}
        size={BannerAdSize.BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: false }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginVertical: 6,
    alignItems: 'center',
  },
  label: {
    fontSize: 9,
    color: '#aaa',
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    alignSelf: 'flex-end',
    marginBottom: 2,
  },
});
