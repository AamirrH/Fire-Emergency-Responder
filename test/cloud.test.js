const test = require('node:test');
const assert = require('node:assert/strict');
const { PNG } = require('pngjs');
const jsQR = require('jsqr');
const { CloudPublisher, publicDashboardUrl } = require('../lib/cloud');
const { createBuilding, generateFingerprintMap } = require('../lib/building');
const { OccupantState } = require('../lib/state');
const config = require('../config');

test('QR decodes to the HTTPS field link and never to localhost', async () => {
  const publisher = new CloudPublisher({ url: 'https://example.com', token: 'test-only', ready: true });
  const image = PNG.sync.read(await publisher.qr());
  const decoded = jsQR(new Uint8ClampedArray(image.data), image.width, image.height);
  assert.equal(decoded.data, 'https://example.com/?view=field');
  assert.throws(() => publicDashboardUrl('http://localhost:3000'));
  assert.throws(() => publicDashboardUrl('https://user:password@example.com'));
  assert.throws(() => publicDashboardUrl('https://example.com/subpath'));
  assert.equal(new CloudPublisher({}).share, null);
});

test('hosted phones receive the same computed state; writes require publisher secret; stale age persists', async () => {
  const { createWorker } = await import('../hosted/worker.js');
  let saved = null;
  const env = { PUBLISH_TOKEN: 'test-only-secret', PUBLIC_DASHBOARD_URL: 'https://example.com', BUCKET: {
    async put(key, value) { assert.equal(key, 'incident/latest.json'); saved = value; },
    async get() { return saved ? { json: async () => JSON.parse(saved) } : null; },
  } };
  const worker = createWorker();
  const read = path => worker.fetch(new Request(`https://example.com${path}`), env);
  assert.equal((await read('/api/state')).status, 503);
  assert.equal((await worker.fetch(new Request('https://example.com/api/ingest', { method: 'PUT', body: '{}' }), env)).status, 401);
  assert.equal((await worker.fetch(new Request('https://example.com/simulate/reset', { method: 'POST', body: '{}' }), env)).status, 403);
  const building = createBuilding(config);
  const state = new OccupantState(building, generateFingerprintMap(building, config), config);
  state.heartbeat({ device_id: 'D001', raw_pressure: 101277, raw_rssi: { 'AP-1': -45, 'AP-2': -70 } });
  state.event('sos', 'D001');
  const snapshot = { ...state.snapshot(), revision: 12 };
  const publisher = new CloudPublisher({ url: 'https://example.com', token: env.PUBLISH_TOKEN,
    fetcher: (url, options) => worker.fetch(new Request(url, options), env) });
  await publisher.publish(snapshot, building);
  assert.equal(publisher.lastError, null);
  const [phone1, phone2] = await Promise.all([read('/api/state'), read('/api/state')]).then(results => Promise.all(results.map(r => r.json())));
  assert.deepEqual(phone1.devices, snapshot.devices);
  assert.deepEqual(phone1.devices, phone2.devices);
  assert.equal(phone1.summary.active_sos, 1);
  const runtime = await (await read('/api/runtime')).json();
  assert.equal(runtime.can_control, false);
  assert.equal(runtime.transport, 'poll');
  const old = JSON.parse(saved); old.received_at -= 10000; saved = JSON.stringify(old);
  assert.ok((await (await read('/api/state')).json()).source_age_ms >= 10000);
  assert.deepEqual((await (await read('/api/building')).json()).aps, building.aps);
});

test('publisher handles cloud failures without losing local state or overlapping uploads', async () => {
  let release, calls = 0;
  const publisher = new CloudPublisher({ url: 'https://example.com', token: 'test-only', ready: true, fetcher: () => { calls++; return new Promise(resolve => { release = resolve; }); } });
  const pending = publisher.publish({}, {});
  await publisher.publish({}, {});
  assert.equal(calls, 1);
  release(new Response('', { status: 503 })); await pending;
  assert.equal(publisher.busy, false);
  assert.match(publisher.lastError, /503/);
});
