import assert from 'node:assert/strict';
import worker from '../worker/index.js';

// /api/map-routes (route groups shared by the web Map Explorer and the
// Chrome extension) needs a signed login for both reads and writes.
const store = new Map();
const env = {
  WORKER_USERNAME: 'operator_test',
  WORKER_PASSWORD: 'secure_password_123',
  RESTAURANTS_KV: {
    async get(k, opts) { const v = store.get(k); return v && opts?.type === 'json' ? JSON.parse(v) : v ?? null; },
    async put(k, v) { store.set(k, v); }
  }
};
const call = (method, headers = {}, body) => worker.fetch(new Request('https://example.test/api/map-routes', {
  method, headers: { 'Content-Type': 'application/json', ...headers }, body: body && JSON.stringify(body)
}), env);
const groups = [{ id: 'g1', name: '路线 1', origin: 'HQ', waypoints: [{ name: 'A', latitude: 43.8, longitude: -79.3 }] }];

assert.equal((await call('GET')).status, 401, 'read without login');
assert.equal((await call('POST', {}, { groups })).status, 401, 'write without login');
assert.equal(store.size, 0, 'rejected write stored nothing');

const forged = btoa(JSON.stringify({ user: env.WORKER_USERNAME, timestamp: Date.now() }));
assert.equal((await call('GET', { Authorization: `Bearer ${forged}` })).status, 401, 'unsigned token');
assert.equal((await call('POST', { Authorization: `Bearer ${forged}` }, { groups })).status, 401);

const login = await worker.fetch(new Request('https://example.test/api/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: env.WORKER_USERNAME, password: env.WORKER_PASSWORD })
}), env);
const { token } = await login.json();
const auth = { Authorization: `Bearer ${token}` };

const saved = await call('POST', auth, { groups, activeGroupId: 'g1' });
assert.equal(saved.status, 200);
const read = await (await call('GET', auth)).json();
assert.equal(read.success, true);
assert.deepEqual(read.data.groups.map((g) => g.waypoints.length), [1]);

const tampered = token.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'));
assert.equal((await call('GET', { Authorization: `Bearer ${tampered}` })).status, 401, 'bad signature');

console.log('✓ map-routes requires a signed login for read and write');
