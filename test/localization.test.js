const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../config');
const { createBuilding, generateFingerprintMap } = require('../lib/building');
const { estimateFloor, estimatePosition } = require('../lib/localization');
const { idealRssi } = require('../lib/physics');
const { Simulator } = require('../lib/simulator');
const { OccupantState } = require('../lib/state');
const building = createBuilding(config);
const fingerprints = generateFingerprintMap(building, config);

test('roster has a distinct call-out name for every device', () => {
  assert.equal(config.OCCUPANT_NAMES.length, config.DEVICE_COUNT);
  assert.equal(new Set(config.OCCUPANT_NAMES).size, config.DEVICE_COUNT);
});

test('pressure formula derives each floor, tolerates all specified pressure noise, rejects invalid altitude', () => {
  for (let floor = 1; floor <= 6; floor++) {
    for (const noise of [-3, 0, 3]) assert.equal(estimateFloor(101325 - floor * 4 * 12 + noise, building, config), floor);
  }
  assert.equal(estimateFloor(101325, building, config), null);
  assert.equal(estimateFloor(NaN, building, config), null);
});

test('fingerprints cover every floor and exact ideal readings recover a known survey point', () => {
  assert.equal(fingerprints.length, 6 * 11 * 11);
  for (let floor = 1; floor <= 6; floor++) {
    const raw = Object.fromEntries(building.aps.map(ap => [ap.id, idealRssi(8, 14, floor, ap, config)]));
    const result = estimatePosition(raw, floor, fingerprints);
    assert.deepEqual(result.position_estimate, { x: 8, y: 14 });
    assert.equal(result.confidence, 0);
    assert.equal(result.matched_ap_count, 18);
  }
});

test('RSSI matching uses only shared APs, restricts floor, and does not invent a position without overlap', () => {
  const survey = [{ floor: 1, x: 0, y: 0, rssi: { a: -40, b: -60 } }, { floor: 1, x: 2, y: 2, rssi: { a: -50, b: -20 } }, { floor: 2, x: 10, y: 10, rssi: { a: -42 } }];
  const match = estimatePosition({ a: -43, unknown: -1 }, 1, survey);
  assert.deepEqual(match.position_estimate, { x: 0, y: 0 });
  assert.equal(match.confidence, 3);
  assert.equal(match.matched_ap_count, 1);
  assert.equal(estimatePosition({}, 1, survey).position_estimate, null);
  assert.equal(estimatePosition({ a: -40 }, null, survey).position_estimate, null);
});

test('simulator emits only raw sensor data with bounded noise and models controls', () => {
  const payloads = [];
  const simulator = new Simulator(building, config, payload => payloads.push(payload), () => .5);
  simulator.tick();
  assert.equal(payloads.length, 36);
  const payload = payloads[0];
  assert.deepEqual(Object.keys(payload).sort(), ['device_id', 'raw_pressure', 'raw_rssi']);
  assert.equal(payload.raw_pressure, 101325 - 4 * 4 * 12);
  assert.equal(Object.keys(payload.raw_rssi).length, 18);
  assert.equal(payload.raw_rssi['AP-1'], idealRssi(10, 10, 4, building.aps[0], config));
  simulator.apDown('AP-1'); simulator.goSilent('D001'); payloads.length = 0; simulator.tick();
  assert.equal(payloads.length, 35);
  assert.equal(Object.hasOwn(payloads[0].raw_rssi, 'AP-1'), false);
  simulator.powerOutage(4); payloads.length = 0; simulator.tick(); assert.equal(payloads.length, 0);
  simulator.reset(); simulator.tick(); assert.equal(payloads.length, 36);
});

test('status priority, ghost distinction, frozen position, AP outage and reset', () => {
  let now = 1000;
  const state = new OccupantState(building, fingerprints, config, () => now);
  const heartbeat = { device_id: 'D001', raw_pressure: 101325 - 48, raw_rssi: fingerprints[0].rssi };
  assert.equal(state.snapshot().summary.unaccounted, 40);
  state.heartbeat(heartbeat);
  const original = state.snapshot().devices[0].position_estimate;
  state.apDown('AP-1');
  assert.equal(state.snapshot().devices[0].status, 'active');
  assert.notEqual(state.snapshot().devices[0].connected_ap, 'AP-1');
  assert.equal(state.snapshot().floors[0].color, 'amber');
  now += 8001;
  assert.equal(state.snapshot().devices[0].status, 'heartbeat_lost');
  assert.deepEqual(state.snapshot().devices[0].position_estimate, original);
  assert.equal(state.snapshot().summary.unaccounted, 39);
  state.event('sos', 'D001');
  assert.equal(state.snapshot().devices[0].status, 'active_sos');
  assert.equal(state.snapshot().floors[0].color, 'red');
  now += 30001;
  assert.equal(state.snapshot().devices[0].status, 'heartbeat_lost');
  state.event('evacuate', 'D001'); state.event('sos', 'D001');
  assert.equal(state.snapshot().devices[0].status, 'safe');
  state.event('sos', 'D040');
  assert.equal(state.snapshot().devices[39].floor, null);
  now += 30001;
  assert.equal(state.snapshot().devices[39].status, 'heartbeat_lost');
  state.reset();
  assert.equal(state.snapshot().summary.unaccounted, 40);
  assert.ok(state.snapshot().aps.every(ap => ap.online));
});

test('heartbeat schema refuses supplied answers, unknown devices/APs and malformed readings', () => {
  const state = new OccupantState(building, fingerprints, config);
  const valid = { device_id: 'D001', raw_pressure: 101277, raw_rssi: {} };
  for (const bad of [{ ...valid, floor: 1 }, { ...valid, true_xy: [1, 2] }, { ...valid, device_id: 'evil' }, { ...valid, raw_pressure: NaN }, { ...valid, raw_rssi: { evil: -40 } }, { ...valid, raw_rssi: [] }]) assert.throws(() => state.heartbeat(bad));
  state.heartbeat(valid);
  assert.equal(state.snapshot().devices[0].name, config.OCCUPANT_NAMES[0]);
  assert.equal(state.snapshot().devices[0].status, 'location_unknown');
  assert.equal(state.snapshot().devices[0].position_estimate, null);
});

test('seeded noisy readings remain useful away from the survey grid', () => {
  let seed = 12345;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const errors = [];
  for (let i = 0; i < 120; i++) {
    const floor = 1 + Math.floor(random() * 6), x = random() * 20, y = random() * 20;
    const pressure = 101325 - floor * 48 + (random() * 2 - 1) * 3;
    const raw = Object.fromEntries(building.aps.map(ap => [ap.id, idealRssi(x, y, floor, ap, config) + (random() * 2 - 1) * 4]));
    const detected = estimateFloor(pressure, building, config);
    assert.equal(detected, floor);
    const position = estimatePosition(raw, detected, fingerprints).position_estimate;
    errors.push(Math.hypot(position.x - x, position.y - y));
  }
  assert.ok(errors.reduce((a, b) => a + b) / errors.length < 2, 'Mean synthetic position error should remain below 2 m.');
});
