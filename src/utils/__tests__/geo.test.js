import { getDistanceMeters, formatDistance, computeRating } from '../geo';

describe('getDistanceMeters', () => {
  it('returns 0 for identical coordinates', () => {
    expect(getDistanceMeters(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
  });

  it('calculates the distance between NYC and LA within 1% accuracy', () => {
    // ~3,940 km
    const dist = getDistanceMeters(40.7128, -74.006, 34.0522, -118.2437);
    expect(dist).toBeGreaterThan(3_900_000);
    expect(dist).toBeLessThan(3_980_000);
  });

  it('calculates a short city-block distance (~111 m per 0.001 degree lat)', () => {
    const dist = getDistanceMeters(40.0, -74.0, 40.001, -74.0);
    expect(dist).toBeGreaterThan(100);
    expect(dist).toBeLessThan(120);
  });

  it('is symmetric — A→B equals B→A', () => {
    const d1 = getDistanceMeters(51.5074, -0.1278, 48.8566, 2.3522);
    const d2 = getDistanceMeters(48.8566, 2.3522, 51.5074, -0.1278);
    expect(d1).toBeCloseTo(d2, 0);
  });
});

describe('formatDistance (imperial, default)', () => {
  it('shows feet for distances under 0.1 miles (~161 m)', () => {
    const result = formatDistance(100);
    expect(result).toMatch(/ft$/);
    expect(result).toContain('328');
  });

  it('shows one decimal mile for distances under 10 miles', () => {
    const result = formatDistance(1609); // ~1 mile
    expect(result).toMatch(/mi$/);
    expect(result).toContain('1.0');
  });

  it('shows rounded miles for distances 10+ miles', () => {
    const result = formatDistance(32187); // ~20 miles
    expect(result).toBe('20 mi');
  });

  it('handles 0 meters', () => {
    const result = formatDistance(0);
    expect(result).toMatch(/ft$/);
  });
});

describe('formatDistance (metric, useKm=true)', () => {
  it('shows meters for distances under 0.1 km', () => {
    const result = formatDistance(50, true);
    expect(result).toMatch(/m$/);
    expect(result).toBe('50 m');
  });

  it('shows one decimal km for distances under 10 km', () => {
    const result = formatDistance(1500, true);
    expect(result).toMatch(/km$/);
    expect(result).toContain('1.5');
  });

  it('shows rounded km for distances 10+ km', () => {
    const result = formatDistance(25000, true);
    expect(result).toBe('25 km');
  });
});

describe('computeRating', () => {
  // Base score is 2.5
  it('returns 2.5 for empty tags (paid, no features)', () => {
    expect(computeRating({ fee: 'yes' })).toBe(2.5);
  });

  it('adds 0.5 when fee is not "yes" (free bonus)', () => {
    expect(computeRating({ fee: 'no' })).toBe(3.0);
    // Undefined fee also gets the free bonus
    expect(computeRating({})).toBe(3.0);
  });

  it('does NOT add the free bonus when fee is "yes"', () => {
    expect(computeRating({ fee: 'yes' })).toBe(2.5);
  });

  it('adds 0.7 for wheelchair access', () => {
    expect(computeRating({ fee: 'yes', wheelchair: 'yes' })).toBe(3.2);
  });

  it('adds 0.4 for changing table', () => {
    expect(computeRating({ fee: 'yes', changing_table: 'yes' })).toBe(2.9);
  });

  it('adds 0.6 for 24/7 opening hours', () => {
    expect(computeRating({ fee: 'yes', opening_hours: '24/7' })).toBe(3.1);
  });

  it('adds 0.3 for a named non-generic location', () => {
    expect(computeRating({ fee: 'yes', name: 'Central Park Restroom' })).toBe(2.8);
  });

  it('does not add name bonus for generic "Public Restroom" name', () => {
    expect(computeRating({ fee: 'yes', name: 'Public Restroom' })).toBe(2.5);
  });

  it('caps at 5.0', () => {
    const rating = computeRating({
      wheelchair: 'yes',
      changing_table: 'yes',
      fee: 'no',
      opening_hours: '24/7',
      name: 'Grand Central Station',
    });
    expect(rating).toBeLessThanOrEqual(5.0);
  });

  it('returns a number with at most 1 decimal place', () => {
    const rating = computeRating({ wheelchair: 'yes', changing_table: 'yes' });
    expect(rating.toString()).toMatch(/^\d+(\.\d)?$/);
  });
});
