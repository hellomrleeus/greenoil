import assert from 'node:assert/strict';
import worker from '../worker/index.js';

// Setup mock KV store
const store = new Map();
const env = {
  WORKER_USERNAME: 'operator_test',
  WORKER_PASSWORD: 'secure_password_123',
  RESTAURANTS_KV: {
    async get(k, opts) {
      const v = store.get(k);
      return v && opts?.type === 'json' ? JSON.parse(v) : v ?? null;
    },
    async put(k, v) {
      store.set(k, v);
    }
  }
};

const call = (url, method = 'GET', headers = {}, body) =>
  worker.fetch(
    new Request(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined
    }),
    env
  );

console.log('1. Testing authentication requirement...');
const unauthGet = await call('https://example.test/api/new-restaurants?period=week');
assert.equal(unauthGet.status, 401, 'GET /api/new-restaurants without token must return 401');

const unauthPost = await call('https://example.test/api/new-restaurants/sync', 'POST', {}, { restaurants: [] });
assert.equal(unauthPost.status, 401, 'POST /api/new-restaurants/sync without token must return 401');

console.log('2. Logging in to obtain valid auth token...');
const loginResp = await worker.fetch(
  new Request('https://example.test/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: env.WORKER_USERNAME, password: env.WORKER_PASSWORD })
  }),
  env
);
assert.equal(loginResp.status, 200);
const { token } = await loginResp.json();
assert.ok(token, 'Token should be returned');
const authHeaders = { Authorization: `Bearer ${token}` };

console.log('3. Testing sync endpoint with mock newly opened restaurants...');
const testRestaurants = [
  {
    id: 'est_001',
    name: 'Toronto New Noodle Bar',
    address: '100 Yonge St, Toronto, ON',
    firstInspectionDate: '2026-10-04',
    latestInspectionDate: '2026-10-04',
    latitude: 43.6499,
    longitude: -79.3789,
    phone: '416-555-0101',
    inspectionCount: 1,
    status: 'Pass'
  },
  {
    id: 'est_002',
    name: 'Scarborough Fresh Grill',
    address: '250 Sheppard Ave E, Toronto, ON',
    firstInspectionDate: '2026-10-01',
    latestInspectionDate: '2026-10-01',
    latitude: 43.7635,
    longitude: -79.3142,
    phone: '416-555-0102',
    inspectionCount: 1,
    status: 'Pass'
  },
  {
    id: 'est_003',
    name: 'Markham Dumpling Master',
    address: '500 Hwy 7, Markham, ON',
    firstInspectionDate: '2026-09-15',
    latestInspectionDate: '2026-09-15',
    latitude: 43.8561,
    longitude: -79.3370,
    phone: '905-555-0103',
    inspectionCount: 2,
    status: 'Pass'
  },
  {
    id: 'est_004',
    name: 'Old Established Diner',
    address: '1 Queen St W, Toronto, ON',
    firstInspectionDate: '2024-01-10',
    latestInspectionDate: '2026-10-02',
    latitude: 43.6525,
    longitude: -79.3790,
    phone: '416-555-0104',
    inspectionCount: 15,
    status: 'Pass'
  }
];

const syncResp = await call(
  'https://example.test/api/new-restaurants/sync',
  'POST',
  authHeaders,
  { restaurants: testRestaurants }
);
assert.equal(syncResp.status, 200, 'Sync should return 200');
const syncJson = await syncResp.json();
assert.equal(syncJson.success, true);
assert.equal(syncJson.count, 4);

console.log('4. Testing query endpoint with period=day (within 1 day from 2026-10-05)...');
const dayResp = await call(
  'https://example.test/api/new-restaurants?period=day&reference_date=2026-10-05',
  'GET',
  authHeaders
);
assert.equal(dayResp.status, 200);
const dayJson = await dayResp.json();
assert.equal(dayJson.success, true);
assert.equal(dayJson.data.length, 1, 'Only est_001 (2026-10-04) should be within 1 day of 2026-10-05');
assert.equal(dayJson.data[0].name, 'Toronto New Noodle Bar');
assert.equal(dayJson.data[0].estimatedOpeningDate, '2026-10-04');
assert.equal(dayJson.data[0].latitude, 43.6499);
assert.equal(dayJson.data[0].longitude, -79.3789);

console.log('5. Testing query endpoint with period=week (within 7 days from 2026-10-05)...');
const weekResp = await call(
  'https://example.test/api/new-restaurants?period=week&reference_date=2026-10-05',
  'GET',
  authHeaders
);
assert.equal(weekResp.status, 200);
const weekJson = await weekResp.json();
assert.equal(weekJson.success, true);
assert.equal(weekJson.data.length, 2, 'est_001 (Oct 4) and est_002 (Oct 1) should be within 7 days');

console.log('6. Testing query endpoint with period=month (within 30 days from 2026-10-05)...');
const monthResp = await call(
  'https://example.test/api/new-restaurants?period=month&reference_date=2026-10-05',
  'GET',
  authHeaders
);
assert.equal(monthResp.status, 200);
const monthJson = await monthResp.json();
assert.equal(monthJson.success, true);
assert.equal(monthJson.data.length, 3, 'est_001, est_002, est_003 (Sep 15) should be within 30 days');

console.log('✓ All backend newly opened restaurants API tests passed!');
