import React, { memo, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const BathroomCard = memo(({ bathroom, onPress, isFavorite, onToggleFavorite }) => {
  const stars = Math.round(bathroom.rating);

  const a11yLabel = useMemo(() => {
    const features = [
      bathroom.accessible && 'wheelchair accessible',
      bathroom.changingTable && 'has baby changing table',
      !bathroom.fee && 'free entry',
      bathroom.fee && 'paid entry',
      bathroom.openingHours === '24/7' && 'open 24 hours',
    ].filter(Boolean).join(', ');

    return [
      bathroom.name,
      `${bathroom.distanceLabel} away`,
      `rated ${bathroom.rating} out of 5 stars`,
      features,
    ].filter(Boolean).join('. ');
  }, [bathroom]);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint="Double tap to view details"
    >
      <View style={styles.iconCol} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {bathroom.image ? (
          <Image source={{ uri: bathroom.image }} style={styles.thumbnail} />
        ) : (
          <Text style={styles.emoji}>🚽</Text>
        )}
        <Text style={styles.distance}>{bathroom.distanceLabel}</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{bathroom.name}</Text>
        <View style={styles.stars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {Array.from({ length: 5 }).map((_, i) => (
            <Ionicons key={i} name={i < stars ? 'star' : 'star-outline'} size={13} color="#B45309" />
          ))}
          <Text style={styles.ratingText}>{bathroom.rating} / 5</Text>
        </View>
        <View style={styles.badges} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {bathroom.accessible && <Badge icon="accessibility" label="Accessible" />}
          {bathroom.changingTable && <Badge icon="person" label="Baby" />}
          {!bathroom.fee && <Badge icon="cash-outline" label="Free" color="#166534" />}
          {bathroom.fee && <Badge icon="cash" label="Paid" color="#991B1B" />}
          {bathroom.openingHours === '24/7' && <Badge icon="time" label="24/7" color="#1E40AF" />}
        </View>
      </View>

      {onToggleFavorite && (
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); onToggleFavorite(bathroom.id); }}
          style={styles.favoriteBtn}
          accessibilityRole="togglebutton"
          accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          accessibilityState={{ checked: isFavorite }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={20} color={isFavorite ? '#E11D48' : '#ccc'} />
        </TouchableOpacity>
      )}

      <Ionicons name="chevron-forward" size={20} color="#767676" style={styles.arrow} accessibilityElementsHidden />
    </TouchableOpacity>
  );
});

export default BathroomCard;

const Badge = memo(({ icon, label, color = '#444' }) => (
  <View style={[styles.badge, { borderColor: color }]}>
    <Ionicons name={icon} size={11} color={color} />
    <Text style={[styles.badgeText, { color }]}>{label}</Text>
  </View>
));

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 6,
    minHeight: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  iconCol: { alignItems: 'center', width: 52 },
  emoji: { fontSize: 32 },
  thumbnail: { width: 64, height: 48, borderRadius: 8, resizeMode: 'cover' },
  distance: { fontSize: 11, color: '#666', marginTop: 2, fontWeight: '600' },
  info: { flex: 1, marginLeft: 10 },
  name: { fontSize: 15, fontWeight: '700', color: '#222', marginBottom: 3 },
  stars: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  ratingText: { fontSize: 12, color: '#666', marginLeft: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 2,
  },
  badgeText: { fontSize: 10, fontWeight: '600' },
  favoriteBtn: {
    marginLeft: 4,
    padding: 6,
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrow: { marginLeft: 2 },
});
