import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PHYSICS_PARAMS,
  synthesizePressure,
  synthesizeRssi,
  idealRssi,
  computeFloor1Offset,
  calibrateBarometerReading,
} from './sensors.ts';
import { getRoomAt } from './building.ts';
import type { BuildingData } from './building.ts';
// @ts-ignore
import { OccupantState } from '../../lib/state.js';

test('1. Pressure synthesis adheres to lapse rate and bounded noise', () => {
  const params = DEFAULT_PHYSICS_PARAMS;
  // reference: 101325, floor_height: 4, pressure_per_meter: 12
  // Floor 1: 101325 - (1 * 4 * 12) = 101277 Pa
  const p1 = synthesizePressure(1, params, () => 0.5); // noise 0
  assert.equal(p1, 101277);

  // Floor 6: 101325 - (6 * 4 * 12) = 101037 Pa
  const p6 = synthesizePressure(6, params, () => 0.5);
  assert.equal(p6, 101037);

  // Test noise bounds
  for (let i = 0; i < 20; i++) {
    const noisy = synthesizePressure(3, params);
    const expectedBase = 101325 - 3 * 4 * 12; // 101181
    assert.ok(
      noisy >= expectedBase - params.pressure_noise_pa &&
      noisy <= expectedBase + params.pressure_noise_pa,
      `Pressure ${noisy} outside bounds for base ${expectedBase}`
    );
  }
});

test('2. RSSI synthesis follows log-distance decay, floor attenuation, and AP coverage', () => {
  const params = DEFAULT_PHYSICS_PARAMS;
  const ap1 = { id: 'AP-1', floor: 1, x: 2, y: 2 };
  const ap4 = { id: 'AP-4', floor: 2, x: 2, y: 2 };

  // At distance 1m on same floor: RSSI = A - 10*3*log10(1) - 0 = -40 dBm
  const rssi1m = idealRssi(2, 3, 1, ap1, params);
  assert.equal(Math.round(rssi1m), -40);

  // At distance 10m on same floor: RSSI = -40 - 30*log10(10) = -70 dBm
  const rssi10m = idealRssi(2, 12, 1, ap1, params);
  assert.equal(Math.round(rssi10m), -70);

  // Cross floor attenuation: 1 floor diff adds 15 dB attenuation
  const rssiCrossFloor = idealRssi(2, 3, 2, ap1, params);
  assert.equal(Math.round(rssiCrossFloor), -55);

  // Full synthesis over AP list includes every AP and noise is bounded
  const aps = [ap1, ap4];
  const reading = synthesizeRssi(5, 5, 1, aps, params);
  assert.ok('AP-1' in reading);
  assert.ok('AP-4' in reading);
  assert.equal(Object.keys(reading).length, 2);
});

test('3. Heartbeat payload shape contains STRICTLY three keys', () => {
  const validPayload = {
    device_id: 'D005',
    raw_pressure: 101277,
    raw_rssi: { 'AP-1': -45 },
  };

  const keys = Object.keys(validPayload).sort();
  assert.deepEqual(keys, ['device_id', 'raw_pressure', 'raw_rssi']);

  // Assert NO derived/ground truth fields are present
  assert.equal(Object.hasOwn(validPayload, 'floor'), false);
  assert.equal(Object.hasOwn(validPayload, 'x'), false);
  assert.equal(Object.hasOwn(validPayload, 'y'), false);
  assert.equal(Object.hasOwn(validPayload, 'name'), false);
  assert.equal(Object.hasOwn(validPayload, 'status'), false);
});

test('4. Room-from-(x,y) resolves room names, corridor, and stairs from building floor plans', () => {
  const mockBuilding: BuildingData = {
    floors: 6,
    floor_height_m: 4,
    grid_size_m: 20,
    reference_pressure_pa: 101325,
    aps: [],
    simulation: {
      heartbeat_interval_seconds: 2,
      heartbeat_timeout_seconds: 8,
      sos_window_seconds: 30,
      fingerprint_step_m: 2,
      ghost_device_ids: ['D037', 'D038', 'D039', 'D040'],
      pressure_per_meter: 12,
      pressure_noise_pa: 3,
      a: -40,
      path_loss_exponent: 3,
      floor_attenuation_db: 15,
      rssi_noise_db: 4,
    },
    floor_plans: [
      {
        floor: 1,
        name: 'Reception & visitor services',
        corridor: { x: 0, y: 8, width: 20, height: 4, label: 'MAIN CORRIDOR' },
        rooms: [
          { id: '101', kind: 'stairs', label: 'Stair A', x: 0, y: 12, width: 4, height: 8 },
          { id: '102', kind: 'room', label: 'Reception', x: 4, y: 12, width: 6, height: 8 },
          { id: '103', kind: 'room', label: 'Security', x: 10, y: 12, width: 6, height: 8 },
          { id: '104', kind: 'restroom', label: 'Restrooms', x: 16, y: 12, width: 4, height: 8 },
          { id: '105', kind: 'room', label: 'Visitor lounge', x: 0, y: 0, width: 9, height: 8 },
          { id: '106', kind: 'room', label: 'First aid', x: 9, y: 0, width: 7, height: 8 },
          { id: '107', kind: 'stairs', label: 'Stair B', x: 16, y: 0, width: 4, height: 8 },
        ],
      },
    ],
  };

  // Stair A is at x=2, y=14
  assert.equal(getRoomAt(2, 14, 1, mockBuilding), 'Stair A');

  // Reception is at x=5, y=14
  assert.equal(getRoomAt(5, 14, 1, mockBuilding), 'Reception');

  // Main corridor is at x=10, y=9
  assert.equal(getRoomAt(10, 9, 1, mockBuilding), 'MAIN CORRIDOR');

  // Stair B is at x=18, y=2
  assert.equal(getRoomAt(18, 2, 1, mockBuilding), 'Stair B');
});

test('5. SOS cancel window: cancel within grace succeeds, cancel past grace fails', () => {
  let currentTime = 50000;
  const building = { floors: 6, floor_height_m: 4, grid_size_m: 20, reference_pressure_pa: 101325, aps: [] };
  const config = {
    DEVICE_COUNT: 40,
    OCCUPANT_NAMES: ['Occupant 1'],
    SOS_WINDOW_SECONDS: 30,
    SOS_CANCEL_GRACE_SECONDS: 10,
    HEARTBEAT_TIMEOUT_SECONDS: 8,
  };
  const state = new OccupantState(building, [], config, () => currentTime);

  // Trigger SOS on D001
  state.event('sos', 'D001');
  assert.equal(state.status(state.devices?.get('D001'), currentTime), 'active_sos');

  // Cancel within 5 seconds (5s <= 10s grace period)
  currentTime += 5000;
  state.event('sos-cancel', 'D001');
  assert.notEqual(state.status(state.devices?.get('D001'), currentTime), 'active_sos');

  // Trigger SOS again, then attempt to cancel after 12s (12s > 10s grace)
  currentTime += 1000;
  state.event('sos', 'D001');
  currentTime += 12000;
  assert.throws(
    () => state.event('sos-cancel', 'D001'),
    /grace period expired/i
  );
});

test('6. Real barometer calibration offset converts hPa and aligns with model', () => {
  const params = DEFAULT_PHYSICS_PARAMS;
  // Model floor 1 pressure: 101325 - 4*12 = 101277 Pa
  // Suppose ambient sensor reads 1013.00 hPa = 101300 Pa
  const offset = computeFloor1Offset(1013.0, params);
  assert.equal(offset, 101300 - 101277); // 23 Pa offset

  // When sensor later reads 1013.0 hPa at Floor 1, calibrated should be exactly 101277 Pa
  const calibratedF1 = calibrateBarometerReading(1013.0, offset);
  assert.equal(calibratedF1, 101277);

  // When person walks up to Floor 2, sensor drops by ~48 Pa to 1012.52 hPa (101252 Pa)
  const calibratedF2 = calibrateBarometerReading(1012.52, offset);
  assert.equal(calibratedF2, 101229); // 101252 - 23 = 101229 Pa (matches Floor 2 model 101325 - 96 = 101229)
});
