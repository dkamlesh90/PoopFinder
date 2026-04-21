import { fetchNearbyBathrooms } from '../bathroomService';

// ─── Fixture data ─────────────────────────────────────────────────────────────

const LAT = 40.7128; // New York City — triggers city source too
const LON = -74.006;

const OVERPASS_RESPONSE = {
  elements: [
    {
      id: 123456, type: 'node', lat: 40.714, lon: -74.008,
      tags: { amenity: 'toilets', name: 'OSM Restroom', fee: 'no', wheelchair: 'yes', opening_hours: '24/7' },
    },
    {
      id: 789, type: 'way', center: { lat: 40.710, lon: -74.004 },
      tags: { amenity: 'toilets', fee: 'yes' },
    },
    {
      // No coordinates — must be filtered out
      id: 999, type: 'node', tags: { amenity: 'toilets' },
    },
  ],
};

const REFUGE_RESPONSE = [
  {
    id: 1, name: 'Refuge Restroom A',
    latitude: '40.720', longitude: '-74.010',
    accessible: true, changing_table: false, unisex: true,
    comment: 'Near the park', street: '1 Park Ave', city: 'New York', state: 'NY',
  },
  {
    // ~13m from OSM 123456 — should be deduped, OSM wins (higher priority)
    id: 2, name: 'Duplicate of OSM Restroom',
    latitude: '40.7141', longitude: '-74.0081',
    accessible: false, changing_table: false, unisex: false, comment: null,
  },
  {
    // Bad coordinates — must be filtered out
    id: 3, name: 'Bad Entry', latitude: 'not-a-number', longitude: 'nope',
  },
];

const WIKIDATA_RESPONSE = {
  results: {
    bindings: [
      {
        item: { value: 'http://www.wikidata.org/entity/Q123' },
        itemLabel: { value: 'Bryant Park Toilets' },
        lat: { value: '40.753' },
        lon: { value: '-74.044' },
      },
      {
        // QID-only label — must be filtered out
        item: { value: 'http://www.wikidata.org/entity/Q456' },
        itemLabel: { value: 'Q456' },
        lat: { value: '40.700' },
        lon: { value: '-74.000' },
      },
      {
        // Bad coordinates — must be filtered out
        item: { value: 'http://www.wikidata.org/entity/Q789' },
        itemLabel: { value: 'Bad Wikidata Entry' },
        lat: { value: 'NaN' },
        lon: { value: 'NaN' },
      },
    ],
  },
};

const NYC_RESPONSE = [
  {
    id: 'nyc_park_001',
    facilityname: 'Bryant Park Comfort Station',
    latitude: '40.7537',
    longitude: '-74.0440',
    accessible: 'Y',
    baby_changing_station: 'Y',
    hours_of_operation: '07:00-23:00',
  },
  {
    // Bad coordinates — must be filtered out
    facilityname: 'Bad NYC Entry',
    latitude: 'bad',
    longitude: 'bad',
  },
];

// ─── Fetch mock helper ────────────────────────────────────────────────────────

function makeFetch({ overpassOk = true, refugeOk = true, wikidataOk = true, nycOk = true } = {}) {
  return jest.fn((url) => {
    if (url.includes('refugerestrooms'))  return refugeOk
      ? Promise.resolve({ ok: true,  json: async () => REFUGE_RESPONSE })
      : Promise.resolve({ ok: false, status: 503, json: async () => ({}) });

    if (url.includes('wikidata'))         return wikidataOk
      ? Promise.resolve({ ok: true,  json: async () => WIKIDATA_RESPONSE })
      : Promise.resolve({ ok: false, status: 503, json: async () => ({}) });

    if (url.includes('cityofnewyork'))    return nycOk
      ? Promise.resolve({ ok: true,  json: async () => NYC_RESPONSE })
      : Promise.resolve({ ok: false, status: 503, json: async () => ({}) });

    // Overpass mirrors
    return overpassOk
      ? Promise.resolve({ ok: true,  json: async () => OVERPASS_RESPONSE })
      : Promise.reject(new Error('Network error'));
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('fetchNearbyBathrooms — all sources succeed', () => {
  beforeEach(() => { global.fetch = makeFetch(); });
  afterEach(() => { delete global.fetch; });

  it('resolves with an array', async () => {
    const result = await fetchNearbyBathrooms(LAT, LON);
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns results from multiple sources', async () => {
    const result = await fetchNearbyBathrooms(LAT, LON);
    const sources = new Set(result.map((b) => b.source));
    expect(sources.size).toBeGreaterThan(1);
  });

  it('results are sorted by distance ascending', async () => {
    const result = await fetchNearbyBathrooms(LAT, LON);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].distance).toBeGreaterThanOrEqual(result[i - 1].distance);
    }
  });

  it('each result has the required shape', async () => {
    const result = await fetchNearbyBathrooms(LAT, LON);
    for (const b of result) {
      expect(b).toMatchObject({
        id: expect.any(String),
        source: expect.stringMatching(/^(osm|refuge|wikidata|city)$/),
        latitude: expect.any(Number),
        longitude: expect.any(Number),
        name: expect.any(String),
        distance: expect.any(Number),
        distanceLabel: expect.any(String),
        rating: expect.any(Number),
      });
      expect(typeof b.fee).toBe('boolean');
      expect(typeof b.accessible).toBe('boolean');
      expect(typeof b.changingTable).toBe('boolean');
    }
  });

  it('filters out elements with no/invalid coordinates', async () => {
    const result = await fetchNearbyBathrooms(LAT, LON);
    expect(result.find((b) => b.id === 'osm_999')).toBeUndefined();
    expect(result.find((b) => b.id === 'refuge_3')).toBeUndefined();
    expect(result.find((b) => b.name === 'Bad Wikidata Entry')).toBeUndefined();
    expect(result.find((b) => b.name === 'Bad NYC Entry')).toBeUndefined();
  });

  it('filters out Wikidata entries whose label is just a QID', async () => {
    const result = await fetchNearbyBathrooms(LAT, LON);
    expect(result.find((b) => b.id === 'wd_Q456')).toBeUndefined();
  });
});

describe('deduplication', () => {
  beforeEach(() => { global.fetch = makeFetch(); });
  afterEach(() => { delete global.fetch; });

  it('drops Refuge entry that is within 60m of an OSM entry', async () => {
    const result = await fetchNearbyBathrooms(LAT, LON);
    expect(result.find((b) => b.id === 'refuge_2')).toBeUndefined();
  });

  it('keeps OSM entry over Refuge when deduped (OSM has higher priority)', async () => {
    const result = await fetchNearbyBathrooms(LAT, LON);
    expect(result.find((b) => b.id === 'osm_123456')).toBeDefined();
  });

  it('city source wins over OSM when they are the same location', async () => {
    // Bryant Park appears in both Wikidata (40.753, -74.044) and NYC dataset (40.7537, -74.044) — ~18m apart
    const result = await fetchNearbyBathrooms(LAT, LON);
    const bryantEntries = result.filter(
      (b) => b.latitude > 40.75 && b.latitude < 40.76 && b.longitude > -74.05 && b.longitude < -74.03
    );
    // Should only have one entry for Bryant Park
    expect(bryantEntries.length).toBe(1);
    // city source should have won
    expect(bryantEntries[0].source).toBe('city');
  });
});

describe('id prefixes', () => {
  beforeEach(() => { global.fetch = makeFetch(); });
  afterEach(() => { delete global.fetch; });

  it('OSM ids start with osm_', async () => {
    const result = await fetchNearbyBathrooms(LAT, LON);
    result.filter((b) => b.source === 'osm').forEach((b) => {
      expect(b.id).toMatch(/^osm_/);
    });
  });

  it('Refuge ids start with refuge_', async () => {
    const result = await fetchNearbyBathrooms(LAT, LON);
    result.filter((b) => b.source === 'refuge').forEach((b) => {
      expect(b.id).toMatch(/^refuge_/);
    });
  });

  it('Wikidata ids start with wd_', async () => {
    const result = await fetchNearbyBathrooms(LAT, LON);
    result.filter((b) => b.source === 'wikidata').forEach((b) => {
      expect(b.id).toMatch(/^wd_/);
    });
  });

  it('city ids start with nyc_', async () => {
    const result = await fetchNearbyBathrooms(LAT, LON);
    result.filter((b) => b.source === 'city').forEach((b) => {
      expect(b.id).toMatch(/^nyc_/);
    });
  });
});

describe('partial source failures', () => {
  afterEach(() => { delete global.fetch; });

  it('resolves with remaining sources when Overpass fails', async () => {
    global.fetch = makeFetch({ overpassOk: false });
    const result = await fetchNearbyBathrooms(LAT, LON);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((b) => b.source !== 'osm')).toBe(true);
  });

  it('resolves with remaining sources when Refuge fails', async () => {
    global.fetch = makeFetch({ refugeOk: false });
    const result = await fetchNearbyBathrooms(LAT, LON);
    expect(result.length).toBeGreaterThan(0);
  });

  it('resolves with remaining sources when Wikidata fails', async () => {
    global.fetch = makeFetch({ wikidataOk: false });
    const result = await fetchNearbyBathrooms(LAT, LON);
    expect(result.length).toBeGreaterThan(0);
  });

  it('resolves with remaining sources when NYC fails', async () => {
    global.fetch = makeFetch({ nycOk: false });
    const result = await fetchNearbyBathrooms(LAT, LON);
    expect(result.length).toBeGreaterThan(0);
  });

  it('throws when ALL sources fail', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('No network'));
    await expect(fetchNearbyBathrooms(LAT, LON)).rejects.toThrow();
  });
});

describe('city source activation', () => {
  afterEach(() => { delete global.fetch; });

  it('does NOT call NYC Open Data when outside NYC bounds', async () => {
    global.fetch = makeFetch();
    // London coordinates
    await fetchNearbyBathrooms(51.5074, -0.1278);
    const nycCalls = global.fetch.mock.calls.filter(([url]) => url.includes('cityofnewyork'));
    expect(nycCalls.length).toBe(0);
  });

  it('DOES call NYC Open Data when inside NYC bounds', async () => {
    global.fetch = makeFetch();
    await fetchNearbyBathrooms(40.7128, -74.006);
    const nycCalls = global.fetch.mock.calls.filter(([url]) => url.includes('cityofnewyork'));
    expect(nycCalls.length).toBeGreaterThan(0);
  });
});
