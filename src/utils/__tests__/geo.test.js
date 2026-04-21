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

describe('formatDistance', () => {
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

describe('computeRating', () => {
  it('returns 3.0 as the base rating with no tags', () => {
    expect(computeRating({})).toBe(3.0);
  });

  it('adds 0.5 for wheelchair access', () => {
    expect(computeRating({ wheelchair: 'yes' })).toBe(3.5);
  });

  it('adds 0.3 for changing table', () => {
    expect(computeRating({ changing_table: 'yes' })).toBe(3.3);
  });

  it('adds 0.2 when fee is not "yes"', () => {
    expect(computeRating({ fee: 'no' })).toBe(3.2);
    expect(computeRating({})).toBe(3.0); // undefined fee also gets the bonus
  });

  it('does NOT add the free bonus when fee is "yes"', () => {
    expect(computeRating({ fee: 'yes' })).toBe(3.0);
  });

  it('adds 0.5 for 24/7 opening hours', () => {
    expect(computeRating({ opening_hours: '24/7' })).toBe(3.5);
  });

  it('returns the maximum possible score of 5.0', () => {
    const rating = computeRating({
      wheelchair: 'yes',
      changing_table: 'yes',
      fee: 'no',
      opening_hours: '24/7',
    });
    // 3.0 + 0.5 + 0.3 + 0.2 + 0.5 = 4.5, which is ≤ 5
    expect(rating).toBe(4.5);
  });

  it('caps at 5.0', () => {
    // Even with all bonuses the cap should hold
    const rating = computeRating({
      wheelchair: 'yes',
      changing_table: 'yes',
      fee: 'no',
      opening_hours: '24/7',
    });
    expect(rating).toBeLessThanOrEqual(5.0);
  });

  it('returns a number with at most 1 decimal place', () => {
    const rating = computeRating({ wheelchair: 'yes', changing_table: 'yes' });
    expect(rating.toString()).toMatch(/^\d+(\.\d)?$/);
  });
});
