import type { AccessPoint, BuildingData } from './building';

export interface PhysicsParams {
  reference_pressure_pa: number;
  floor_height_m: number;
  pressure_per_meter: number;
  pressure_noise_pa: number;
  a: number;
  path_loss_exponent: number;
  floor_attenuation_db: number;
  rssi_noise_db: number;
}

export const DEFAULT_PHYSICS_PARAMS: PhysicsParams = {
  reference_pressure_pa: 101325,
  floor_height_m: 4,
  pressure_per_meter: 12,
  pressure_noise_pa: 3,
  a: -40,
  path_loss_exponent: 3,
  floor_attenuation_db: 15,
  rssi_noise_db: 4,
};

/**
 * Extracts physics parameters from BuildingData or uses default constants.
 */
export function extractPhysicsParams(building?: BuildingData | null): PhysicsParams {
  if (!building) return DEFAULT_PHYSICS_PARAMS;
  return {
    reference_pressure_pa: building.reference_pressure_pa ?? DEFAULT_PHYSICS_PARAMS.reference_pressure_pa,
    floor_height_m: building.floor_height_m ?? DEFAULT_PHYSICS_PARAMS.floor_height_m,
    pressure_per_meter: building.simulation?.pressure_per_meter ?? DEFAULT_PHYSICS_PARAMS.pressure_per_meter,
    pressure_noise_pa: building.simulation?.pressure_noise_pa ?? DEFAULT_PHYSICS_PARAMS.pressure_noise_pa,
    a: building.simulation?.a ?? DEFAULT_PHYSICS_PARAMS.a,
    path_loss_exponent: building.simulation?.path_loss_exponent ?? DEFAULT_PHYSICS_PARAMS.path_loss_exponent,
    floor_attenuation_db: building.simulation?.floor_attenuation_db ?? DEFAULT_PHYSICS_PARAMS.floor_attenuation_db,
    rssi_noise_db: building.simulation?.rssi_noise_db ?? DEFAULT_PHYSICS_PARAMS.rssi_noise_db,
  };
}

/**
 * Generates symmetric uniform noise in range [-magnitude, +magnitude].
 */
export function uniformNoise(magnitude: number, random = Math.random): number {
  return (random() * 2 - 1) * magnitude;
}

/**
 * Synthesizes pure raw pressure based on floor and atmospheric lapse model.
 * raw_pressure = REFERENCE_PRESSURE_PA - PRESSURE_PER_METER * FLOOR_HEIGHT_M * floor + uniform_noise(PRESSURE_NOISE_PA)
 */
export function synthesizePressure(
  floor: number,
  params: PhysicsParams = DEFAULT_PHYSICS_PARAMS,
  random = Math.random,
): number {
  const base = params.reference_pressure_pa - floor * params.floor_height_m * params.pressure_per_meter;
  return base + uniformNoise(params.pressure_noise_pa, random);
}

/**
 * Ideal signal propagation formula without noise:
 * RSSI = A - 10 * n * log10(max(d_horizontal, 0.1)) - abs(floor - ap_floor) * FLOOR_ATTENUATION_DB
 */
export function idealRssi(
  x: number,
  y: number,
  floor: number,
  ap: AccessPoint,
  params: PhysicsParams = DEFAULT_PHYSICS_PARAMS,
): number {
  const horizontalDist = Math.max(Math.hypot(x - ap.x, y - ap.y), 0.1);
  return (
    params.a -
    10 * params.path_loss_exponent * Math.log10(horizontalDist) -
    Math.abs(floor - ap.floor) * params.floor_attenuation_db
  );
}

/**
 * Synthesizes raw RSSI dictionary for all APs:
 * ap_id -> idealRssi + uniform_noise(RSSI_NOISE_DB)
 */
export function synthesizeRssi(
  x: number,
  y: number,
  floor: number,
  aps: AccessPoint[],
  params: PhysicsParams = DEFAULT_PHYSICS_PARAMS,
  random = Math.random,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const ap of aps) {
    const ideal = idealRssi(x, y, floor, ap, params);
    const noisy = ideal + uniformNoise(params.rssi_noise_db, random);
    result[ap.id] = Math.round(noisy * 10) / 10;
  }
  return result;
}

/**
 * Calibrates real device barometer (hPa):
 * Converts hPa to Pa, then applies the Floor 1 offset so real atmospheric pressure
 * aligns with the building simulation model.
 */
export function computeFloor1Offset(
  measuredHpa: number,
  params: PhysicsParams = DEFAULT_PHYSICS_PARAMS,
): number {
  const measuredPa = measuredHpa * 100;
  const floor1ModelPa = params.reference_pressure_pa - 1 * params.floor_height_m * params.pressure_per_meter;
  return measuredPa - floor1ModelPa;
}

export function calibrateBarometerReading(measuredHpa: number, floor1OffsetPa: number): number {
  const measuredPa = measuredHpa * 100;
  return Math.round((measuredPa - floor1OffsetPa) * 10) / 10;
}
