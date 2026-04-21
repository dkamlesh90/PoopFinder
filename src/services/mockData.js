import { getDistanceMeters, formatDistance, computeRating } from '../utils/geo';

const RAW = [
  {
    id: 'mock_1', _offsetLat: 0.003, _offsetLon: 0.001,
    name: 'Starbucks - Main St',
    fee: false, accessible: true, changingTable: true,
    openingHours: '06:00-22:00', unisex: false, male: true, female: true,
    description: 'Ask barista for code: 1234',
    image: 'https://source.unsplash.com/600x400/?coffee-shop,bathroom',
  },
  {
    id: 'mock_2', _offsetLat: -0.005, _offsetLon: 0.004,
    name: 'City Park Public Restroom',
    fee: false, accessible: true, changingTable: false,
    openingHours: '24/7', unisex: true, male: true, female: true,
    description: null,
    image: 'https://source.unsplash.com/600x400/?park,public-restroom',
  },
  {
    id: 'mock_3', _offsetLat: 0.008, _offsetLon: -0.003,
    name: "McDonald's - 5th Avenue",
    fee: false, accessible: true, changingTable: true,
    openingHours: '24/7', unisex: false, male: true, female: true,
    description: null,
    image: 'https://source.unsplash.com/600x400/?fast-food,bathroom',
  },
  {
    id: 'mock_4', _offsetLat: -0.002, _offsetLon: -0.007,
    name: 'Grand Central Station - Lower Level',
    fee: true, accessible: true, changingTable: true,
    openingHours: '05:30-01:00', unisex: false, male: true, female: true,
    description: '$1.00 entry fee. Very clean.',
    image: 'https://source.unsplash.com/600x400/?train-station,restroom',
  },
  {
    id: 'mock_5', _offsetLat: 0.011, _offsetLon: 0.009,
    name: 'Community Center Restroom',
    fee: false, accessible: false, changingTable: false,
    openingHours: '08:00-18:00', unisex: false, male: true, female: true,
    description: null,
    image: 'https://source.unsplash.com/600x400/?community-center,bathroom',
  },
  {
    id: 'mock_6', _offsetLat: -0.009, _offsetLon: 0.011,
    name: 'Shopping Mall - Food Court',
    fee: false, accessible: true, changingTable: true,
    openingHours: '09:00-21:00', unisex: false, male: true, female: true,
    description: 'Family restroom available.',
    image: 'https://source.unsplash.com/600x400/?mall,bathroom',
  },
  {
    id: 'mock_7', _offsetLat: 0.001, _offsetLon: -0.012,
    name: 'Sketchy Gas Station Bathroom',
    fee: false, accessible: false, changingTable: false,
    openingHours: null, unisex: true, male: true, female: true,
    description: 'Bring your own toilet paper.',
    image: 'https://source.unsplash.com/600x400/?gas-station,bathroom',
  },
  {
    id: 'mock_8', _offsetLat: 0.014, _offsetLon: -0.005,
    name: 'Hotel Lobby Restroom',
    fee: false, accessible: true, changingTable: false,
    openingHours: '24/7', unisex: false, male: true, female: true,
    description: "Act like you're a guest.",
    image: 'https://source.unsplash.com/600x400/?hotel,restroom',
  },
];

export function getMockBathrooms(userLat, userLon) {
  return RAW.map((b) => {
    const latitude = userLat + b._offsetLat;
    const longitude = userLon + b._offsetLon;
    const distance = getDistanceMeters(userLat, userLon, latitude, longitude);
    return {
      id: b.id,
      latitude,
      longitude,
      name: b.name,
      fee: b.fee,
      accessible: b.accessible,
      changingTable: b.changingTable,
      openingHours: b.openingHours,
      unisex: b.unisex,
      male: b.male,
      female: b.female,
      description: b.description,
      image: b.image || null,
      distance,
      distanceLabel: formatDistance(distance),
      rating: computeRating({
        wheelchair: b.accessible ? 'yes' : 'no',
        changing_table: b.changingTable ? 'yes' : 'no',
        fee: b.fee ? 'yes' : 'no',
        opening_hours: b.openingHours,
      }),
    };
  }).sort((a, b) => a.distance - b.distance);
}
