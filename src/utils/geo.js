export function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(meters) {
  const miles = meters / 1609.344;
  if (miles < 0.1) return `${Math.round(meters * 3.28084)} ft`;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export function computeRating({ wheelchair, changing_table, fee, opening_hours }) {
  let score = 3.0;
  if (wheelchair === 'yes') score += 0.5;
  if (changing_table === 'yes') score += 0.3;
  if (fee !== 'yes') score += 0.2;
  if (opening_hours === '24/7') score += 0.5;
  return Math.min(5, parseFloat(score.toFixed(1)));
}
