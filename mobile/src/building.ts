export interface SimulationConstants {
  heartbeat_interval_seconds: number;
  heartbeat_timeout_seconds: number;
  sos_window_seconds: number;
  sos_cancel_grace_seconds?: number;
  fingerprint_step_m: number;
  ghost_device_ids: string[];
  pressure_per_meter: number;
  pressure_noise_pa: number;
  a: number;
  path_loss_exponent: number;
  floor_attenuation_db: number;
  rssi_noise_db: number;
}

export interface AccessPoint {
  id: string;
  floor: number;
  x: number;
  y: number;
}

export interface RoomDoor {
  side: 'north' | 'south' | 'east' | 'west';
  x: number;
  width: number;
}

export interface FloorRoom {
  id: string;
  kind: 'room' | 'stairs' | 'restroom';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  door?: RoomDoor;
}

export interface Corridor {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

export interface FloorPlan {
  floor: number;
  name: string;
  corridor: Corridor;
  rooms: FloorRoom[];
}

export interface BuildingData {
  floors: number;
  floor_height_m: number;
  grid_size_m: number;
  reference_pressure_pa: number;
  aps: AccessPoint[];
  floor_plans: FloorPlan[];
  simulation: SimulationConstants;
}

/**
 * Resolves room name from (x, y) coordinates and floor number using building.json floor_plans.
 */
export function getRoomAt(x: number | null, y: number | null, floor: number | null, building: BuildingData | null): string {
  if (x === null || y === null || floor === null || !building || !building.floor_plans) {
    return 'Location pending';
  }

  const plan = building.floor_plans.find(p => p.floor === floor);
  if (!plan) return `Floor ${floor} (General)`;

  // Check specific rooms (including stairs and restrooms)
  for (const room of plan.rooms) {
    if (x >= room.x && x <= room.x + room.width && y >= room.y && y <= room.y + room.height) {
      return room.label;
    }
  }

  // Check corridor
  if (plan.corridor) {
    const c = plan.corridor;
    if (x >= c.x && x <= c.x + c.width && y >= c.y && y <= c.y + c.height) {
      return c.label;
    }
  }

  return `Floor ${floor} Area`;
}
