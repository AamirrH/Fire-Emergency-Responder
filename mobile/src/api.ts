import { BuildingData } from './building';

export interface HeartbeatPayload {
  device_id: string;
  raw_pressure: number;
  raw_rssi: Record<string, number>;
}

export interface DeviceStatusResponse {
  device_id: string;
  name: string;
  status: 'active' | 'active_sos' | 'heartbeat_lost' | 'unaccounted' | 'safe' | 'location_unknown';
  floor: number | null;
  x: number | null;
  y: number | null;
  match_distance_db: number | null;
  confidence: number | null;
  matched_ap_count: number;
  connected_ap: string | null;
  last_heartbeat: number | null;
  last_event: number | null;
  raw_pressure: number | null;
}

function cleanUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

export async function fetchBuilding(serverUrl: string): Promise<BuildingData> {
  const url = `${cleanUrl(serverUrl)}/api/building`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to load building (${res.status}): ${text || res.statusText}`);
  }
  return res.json();
}

export async function claimDevice(
  serverUrl: string,
  deviceToken: string,
  deviceId: string,
): Promise<{ ok: boolean; claimed: string }> {
  const url = `${cleanUrl(serverUrl)}/api/device/claim`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-device-token': deviceToken,
    },
    body: JSON.stringify({ device_id: deviceId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(data.error || `Claim failed (${res.status})`);
  }
  return res.json();
}

export async function releaseDevice(
  serverUrl: string,
  deviceToken: string,
  deviceId: string,
): Promise<{ ok: boolean; released: string }> {
  const url = `${cleanUrl(serverUrl)}/api/device/release`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-device-token': deviceToken,
    },
    body: JSON.stringify({ device_id: deviceId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(data.error || `Release failed (${res.status})`);
  }
  return res.json();
}

/**
 * Sends RAW sensor measurements only.
 * HARD RULE: payload MUST contain only { device_id, raw_pressure, raw_rssi }.
 */
export async function sendHeartbeat(
  serverUrl: string,
  deviceToken: string,
  payload: HeartbeatPayload,
): Promise<{ ok: boolean }> {
  // Validate strict keys before network transmission
  const keys = Object.keys(payload).sort().join(',');
  if (keys !== 'device_id,raw_pressure,raw_rssi') {
    throw new Error(`Invalid payload keys: ${keys}. Must be device_id, raw_pressure, raw_rssi only.`);
  }

  const url = `${cleanUrl(serverUrl)}/api/device/heartbeat`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-device-token': deviceToken,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(data.error || `Heartbeat failed (${res.status})`);
  }
  return res.json();
}

export async function sendSos(
  serverUrl: string,
  deviceToken: string,
  deviceId: string,
): Promise<{ ok: boolean; revision: number }> {
  const url = `${cleanUrl(serverUrl)}/api/device/sos`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-device-token': deviceToken,
    },
    body: JSON.stringify({ device_id: deviceId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(data.error || `SOS trigger failed (${res.status})`);
  }
  return res.json();
}

export async function cancelSos(
  serverUrl: string,
  deviceToken: string,
  deviceId: string,
): Promise<{ ok: boolean; revision: number }> {
  const url = `${cleanUrl(serverUrl)}/api/device/sos-cancel`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-device-token': deviceToken,
    },
    body: JSON.stringify({ device_id: deviceId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(data.error || `SOS cancel failed (${res.status})`);
  }
  return res.json();
}

export async function fetchDeviceStatus(
  serverUrl: string,
  deviceToken: string,
  deviceId: string,
): Promise<DeviceStatusResponse> {
  const url = `${cleanUrl(serverUrl)}/api/device/${encodeURIComponent(deviceId)}/status`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'x-device-token': deviceToken,
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(data.error || `Fetch status failed (${res.status})`);
  }
  return res.json();
}
