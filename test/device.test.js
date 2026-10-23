const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');
const defaults = require('../config');

test('Device API endpoints, CORS, token auth, claim/release, and SOS cancel grace period', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-device-test-'));
  let now = 200000;
  const token = 'secret-token-xyz';
  const app = createApp({
    directory,
    config: { ...defaults, HEARTBEAT_INTERVAL_MS: 100000, STATE_INTERVAL_MS: 100000, SOS_CANCEL_GRACE_SECONDS: 10 },
    clock: () => now,
    random: () => 0.5,
    deviceToken: token,
  });
  const address = await app.start(0);
  const base = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    await app.stop();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const deviceFetch = (route, options = {}) => {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    return fetch(base + route, { ...options, headers });
  };

  // 1. Physical constants exposed under simulation in /api/building
  const buildingRes = await fetch(base + '/api/building');
  assert.equal(buildingRes.status, 200);
  const buildingData = await buildingRes.json();
  assert.equal(buildingData.simulation.pressure_per_meter, 12);
  assert.equal(buildingData.simulation.pressure_noise_pa, 3);
  assert.equal(buildingData.simulation.a, -40);
  assert.equal(buildingData.simulation.path_loss_exponent, 3);
  assert.equal(buildingData.simulation.floor_attenuation_db, 15);
  assert.equal(buildingData.simulation.rssi_noise_db, 4);
  assert.equal(buildingData.simulation.heartbeat_interval_seconds, 100);

  // 2. CORS on /api/device/*
  const optionsRes = await fetch(base + '/api/device/heartbeat', { method: 'OPTIONS' });
  assert.equal(optionsRes.status, 204);
  assert.equal(optionsRes.headers.get('access-control-allow-origin'), '*');
  assert.ok(optionsRes.headers.get('access-control-allow-headers')?.includes('x-device-token'));

  // 3. Unauthorized access to /api/device/* without token or with wrong token
  const noTokenRes = await deviceFetch('/api/device/heartbeat', { method: 'POST', body: JSON.stringify({ device_id: 'D005' }) });
  assert.equal(noTokenRes.status, 401);
  const badTokenRes = await deviceFetch('/api/device/heartbeat', {
    method: 'POST',
    headers: { 'x-device-token': 'wrong-token' },
    body: JSON.stringify({ device_id: 'D005' }),
  });
  assert.equal(badTokenRes.status, 401);

  // 4. Claim and Release
  const claimRes = await deviceFetch('/api/device/claim', {
    method: 'POST',
    headers: { 'x-device-token': token },
    body: JSON.stringify({ device_id: 'D005' }),
  });
  assert.equal(claimRes.status, 200);
  assert.equal((await claimRes.json()).claimed, 'D005');
  assert.equal(app.simulator.isClaimed('D005'), true);

  // Verify simulator tick does NOT generate heartbeats for claimed device
  const claimedDevice = app.state.devices.get('D005');
  const lastHeartbeatBeforeTick = claimedDevice.last_heartbeat;
  app.simulator.tick();
  assert.equal(claimedDevice.last_heartbeat, lastHeartbeatBeforeTick);

  // Release device
  const releaseRes = await deviceFetch('/api/device/release', {
    method: 'POST',
    headers: { 'x-device-token': token },
    body: JSON.stringify({ device_id: 'D005' }),
  });
  assert.equal(releaseRes.status, 200);
  assert.equal((await releaseRes.json()).released, 'D005');
  assert.equal(app.simulator.isClaimed('D005'), false);

  // Re-claim for phone testing
  await deviceFetch('/api/device/claim', {
    method: 'POST',
    headers: { 'x-device-token': token },
    body: JSON.stringify({ device_id: 'D005' }),
  });

  // 5. POST /api/device/heartbeat
  // Raw pressure for Floor 3: 101325 - 3 * 4 * 12 = 101181 Pa
  const rawRssi = { 'AP-7': -45, 'AP-8': -55, 'AP-9': -60 };
  const hbRes = await deviceFetch('/api/device/heartbeat', {
    method: 'POST',
    headers: { 'x-device-token': token },
    body: JSON.stringify({ device_id: 'D005', raw_pressure: 101181, raw_rssi: rawRssi }),
  });
  assert.equal(hbRes.status, 200);
  assert.deepEqual(await hbRes.json(), { ok: true });

  // 6. GET /api/device/:id/status
  const statusRes = await deviceFetch('/api/device/D005/status', {
    headers: { 'x-device-token': token },
  });
  assert.equal(statusRes.status, 200);
  const statusData = await statusRes.json();
  assert.equal(statusData.device_id, 'D005');
  assert.equal(statusData.floor, 3);
  assert.equal(statusData.status, 'active');
  assert.ok(statusData.x !== null && statusData.y !== null);
  assert.ok(statusData.confidence !== null);
  assert.equal(statusData.last_heartbeat, now);

  // 7. POST /api/device/sos and /api/device/sos-cancel
  const sosRes = await deviceFetch('/api/device/sos', {
    method: 'POST',
    headers: { 'x-device-token': token },
    body: JSON.stringify({ device_id: 'D005' }),
  });
  assert.equal(sosRes.status, 200);
  const statusAfterSos = await (await deviceFetch('/api/device/D005/status', { headers: { 'x-device-token': token } })).json();
  assert.equal(statusAfterSos.status, 'active_sos');

  // Cancel within grace period (grace is 10s, advance 4s)
  now += 4000;
  const cancelRes = await deviceFetch('/api/device/sos-cancel', {
    method: 'POST',
    headers: { 'x-device-token': token },
    body: JSON.stringify({ device_id: 'D005' }),
  });
  assert.equal(cancelRes.status, 200);
  const statusAfterCancel = await (await deviceFetch('/api/device/D005/status', { headers: { 'x-device-token': token } })).json();
  assert.equal(statusAfterCancel.status, 'active');

  // Trigger SOS again, then advance time PAST grace period
  now += 1000;
  await deviceFetch('/api/device/sos', {
    method: 'POST',
    headers: { 'x-device-token': token },
    body: JSON.stringify({ device_id: 'D005' }),
  });
  now += 11000; // 11s > 10s grace
  const expiredCancelRes = await deviceFetch('/api/device/sos-cancel', {
    method: 'POST',
    headers: { 'x-device-token': token },
    body: JSON.stringify({ device_id: 'D005' }),
  });
  assert.equal(expiredCancelRes.status, 400);
  const errJson = await expiredCancelRes.json();
  assert.match(errJson.error, /grace period expired/i);
});
