import { getMockBathrooms } from '../mockData';

const USER_LAT = 40.7128;
const USER_LON = -74.006;

describe('getMockBathrooms', () => {
  let bathrooms;

  beforeAll(() => {
    bathrooms = getMockBathrooms(USER_LAT, USER_LON);
  });

  it('returns 8 bathrooms', () => {
    expect(bathrooms).toHaveLength(8);
  });

  it('returns results sorted by distance ascending', () => {
    for (let i = 1; i < bathrooms.length; i++) {
      expect(bathrooms[i].distance).toBeGreaterThanOrEqual(bathrooms[i - 1].distance);
    }
  });

  it('each bathroom has required fields', () => {
    for (const b of bathrooms) {
      expect(b).toHaveProperty('id');
      expect(b).toHaveProperty('latitude');
      expect(b).toHaveProperty('longitude');
      expect(b).toHaveProperty('name');
      expect(b).toHaveProperty('distance');
      expect(b).toHaveProperty('distanceLabel');
      expect(b).toHaveProperty('rating');
      expect(typeof b.fee).toBe('boolean');
      expect(typeof b.accessible).toBe('boolean');
      expect(typeof b.changingTable).toBe('boolean');
    }
  });

  it('coordinates are offset from user position', () => {
    for (const b of bathrooms) {
      // Should be near the user but not identical
      expect(Math.abs(b.latitude - USER_LAT)).toBeLessThan(0.1);
      expect(Math.abs(b.longitude - USER_LON)).toBeLessThan(0.1);
    }
  });

  it('distance values are positive numbers in meters', () => {
    for (const b of bathrooms) {
      expect(b.distance).toBeGreaterThan(0);
      expect(typeof b.distance).toBe('number');
    }
  });

  it('distanceLabel is a non-empty string', () => {
    for (const b of bathrooms) {
      expect(typeof b.distanceLabel).toBe('string');
      expect(b.distanceLabel.length).toBeGreaterThan(0);
    }
  });

  it('rating is between 1 and 5', () => {
    for (const b of bathrooms) {
      expect(b.rating).toBeGreaterThanOrEqual(1);
      expect(b.rating).toBeLessThanOrEqual(5);
    }
  });

  it('works at different user coordinates', () => {
    const la = getMockBathrooms(34.0522, -118.2437);
    expect(la).toHaveLength(8);
    // Coordinates should be shifted relative to LA
    expect(la[0].latitude).toBeCloseTo(34.0522, 0);
    expect(la[0].longitude).toBeCloseTo(-118.2437, 0);
  });
});
