// Actual pressure-to-height conversion: pressure drop / Pa per meter gives
// altitude relative to the fixed reference; divide by floor height and round.
// Reject out-of-building results instead of inventing a valid floor by clamping.
function estimateFloor(rawPressure, building, config) {
  if (!Number.isFinite(rawPressure)) return null;
  const floor = Math.round((building.reference_pressure_pa - rawPressure)
    / (config.PRESSURE_PER_METER * building.floor_height_m));
  return floor >= 1 && floor <= building.floors ? floor : null;
}

// Nearest-neighbor fingerprinting in SIGNAL space, not physical space.
// Restrict the survey to the independently pressure-derived floor. Compare only
// APs in both vectors. The returned Euclidean residual is a distance in dB,
// not a probability; smaller is better. No overlap means no position estimate.
function estimatePosition(rawRssi, floor, fingerprints) {
  let best = null;
  for (const point of fingerprints) {
    if (point.floor !== floor) continue;
    const shared = Object.keys(point.rssi).filter(id => Number.isFinite(rawRssi[id]));
    if (!shared.length) continue;
    const distance = Math.sqrt(shared.reduce((sum, id) => sum + (point.rssi[id] - rawRssi[id]) ** 2, 0));
    if (!best || distance < best.confidence) {
      best = { position_estimate: { x: point.x, y: point.y }, confidence: distance, matched_ap_count: shared.length };
    }
  }
  return best || { position_estimate: null, confidence: null, matched_ap_count: 0 };
}

module.exports = { estimateFloor, estimatePosition };
