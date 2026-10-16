const fs = require('node:fs');
const path = require('node:path');
const { idealRssi } = require('./physics');
const { createFloorPlans } = require('./floorplans');

function createBuilding(config) {
  const anchors = [[0.1, 0.1], [0.9, 0.1], [0.5, 0.9]];
  return {
    floors: config.FLOORS,
    floor_height_m: config.FLOOR_HEIGHT_M,
    grid_size_m: config.GRID_SIZE_M,
    reference_pressure_pa: config.REFERENCE_PRESSURE_PA,
    floor_plans: createFloorPlans(config.FLOORS, config.GRID_SIZE_M),
    aps: Array.from({ length: config.FLOORS }, (_, index) => anchors.map(([x, y], a) => ({
      id: `AP-${index * 3 + a + 1}`, floor: index + 1,
      x: x * config.GRID_SIZE_M, y: y * config.GRID_SIZE_M,
    }))).flat(),
  };
}

function loadBuilding(directory, config) {
  const filename = path.join(directory, 'building.json');
  const expected = createBuilding(config);
  if (!fs.existsSync(filename)) fs.writeFileSync(filename, JSON.stringify(expected, null, 2) + '\n');
  const building = JSON.parse(fs.readFileSync(filename, 'utf8'));
  for (const key of ['floors', 'floor_height_m', 'grid_size_m', 'reference_pressure_pa']) {
    if (building[key] !== expected[key]) throw new Error(`building.json ${key} conflicts with config.js. Remove building.json to regenerate it.`);
  }
  const ids = new Set();
  if (!Array.isArray(building.aps) || building.aps.length !== config.FLOORS * 3) throw new Error('Expected three APs per floor.');
  for (const ap of building.aps) {
    if (!ap.id || ids.has(ap.id) || !Number.isInteger(ap.floor) || ap.floor < 1 || ap.floor > config.FLOORS
      || ![ap.x, ap.y].every(v => Number.isFinite(v) && v >= 0 && v <= config.GRID_SIZE_M)) throw new Error('Invalid building AP.');
    ids.add(ap.id);
  }
  for (let floor = 1; floor <= config.FLOORS; floor++) {
    if (building.aps.filter(ap => ap.floor === floor).length !== 3) throw new Error('Expected three APs per floor.');
  }
  // Upgrade an existing generated building without changing its AP coordinates.
  if (!building.floor_plans) {
    building.floor_plans = createFloorPlans(building.floors, building.grid_size_m);
    fs.writeFileSync(filename, JSON.stringify(building, null, 2) + '\n');
  }
  return building;
}

// A synthetic survey, generated BEFORE serving requests. Each labeled grid point
// stores the noise-free signal vector for all APs. It is independent of occupants.
// In production these labels/vectors would come from an installer survey.
function generateFingerprintMap(building, config) {
  const points = [];
  for (let floor = 1; floor <= building.floors; floor++) {
    for (let x = 0; x <= building.grid_size_m; x += config.FINGERPRINT_STEP_M) {
      for (let y = 0; y <= building.grid_size_m; y += config.FINGERPRINT_STEP_M) {
        points.push({ floor, x, y, rssi: Object.fromEntries(building.aps.map(ap => [ap.id, idealRssi(x, y, floor, ap, config)])) });
      }
    }
  }
  return points;
}

module.exports = { createBuilding, loadBuilding, generateFingerprintMap };
