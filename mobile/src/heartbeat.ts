import { Barometer } from 'expo-sensors';
import { BuildingData } from './building';
import { extractPhysicsParams, synthesizePressure, synthesizeRssi, calibrateBarometerReading } from './sensors';
import { sendHeartbeat, HeartbeatPayload } from './api';

export type SensorMode = 'simulated' | 'barometer';

export interface HeartbeatState {
  lastSentTimestamp: number | null;
  totalSentCount: number;
  lastPressure: number | null;
  lastRssi: Record<string, number>;
  isOffline: boolean;
  offlineError: string | null;
  isSilent: boolean; // "phone dying" simulation
  sensorMode: SensorMode;
  heartbeatIntervalSec: number;
  virtualFloor: number;
  virtualX: number;
  virtualY: number;
  barometerOffsetPa: number;
}

export type HeartbeatListener = (state: HeartbeatState) => void;

export class HeartbeatEngine {
  private timer: ReturnType<typeof setInterval> | null = null;
  private serverUrl: string = '';
  private deviceToken: string = '';
  private deviceId: string = '';
  private building: BuildingData | null = null;
  private barometerSubscription: { remove: () => void } | null = null;
  private latestRealHpa: number | null = null;

  private state: HeartbeatState = {
    lastSentTimestamp: null,
    totalSentCount: 0,
    lastPressure: null,
    lastRssi: {},
    isOffline: false,
    offlineError: null,
    isSilent: false,
    sensorMode: 'simulated',
    heartbeatIntervalSec: 2,
    virtualFloor: 1,
    virtualX: 10,
    virtualY: 10,
    barometerOffsetPa: 0,
  };

  private listeners = new Set<HeartbeatListener>();

  public configure(
    serverUrl: string,
    deviceToken: string,
    deviceId: string,
    building: BuildingData,
  ) {
    this.serverUrl = serverUrl;
    this.deviceToken = deviceToken;
    this.deviceId = deviceId;
    this.building = building;

    const intervalSec = building.simulation?.heartbeat_interval_seconds ?? 2;
    this.state.heartbeatIntervalSec = intervalSec;
    this.notify();
  }

  public setVirtualPosition(floor: number, x: number, y: number) {
    const maxGrid = this.building?.grid_size_m ?? 20;
    const maxFloors = this.building?.floors ?? 6;

    this.state.virtualFloor = Math.max(1, Math.min(maxFloors, Math.round(floor)));
    this.state.virtualX = Math.max(0, Math.min(maxGrid, Math.round(x * 10) / 10));
    this.state.virtualY = Math.max(0, Math.min(maxGrid, Math.round(y * 10) / 10));
    this.notify();
  }

  public setSensorMode(mode: SensorMode) {
    this.state.sensorMode = mode;
    if (mode === 'barometer') {
      this.startBarometer();
    } else {
      this.stopBarometer();
    }
    this.notify();
  }

  public setBarometerOffset(offsetPa: number) {
    this.state.barometerOffsetPa = offsetPa;
    this.notify();
  }

  public setSilent(silent: boolean) {
    this.state.isSilent = silent;
    this.notify();
  }

  public start() {
    this.stop();
    const intervalMs = Math.max(1000, this.state.heartbeatIntervalSec * 1000);
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
    // Trigger immediate first heartbeat
    void this.tick();
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async tick(): Promise<void> {
    if (this.state.isSilent || !this.deviceId || !this.serverUrl || !this.building) {
      return;
    }

    const physics = extractPhysicsParams(this.building);

    // Compute raw pressure: simulated or real calibrated barometer
    let raw_pressure: number;
    if (this.state.sensorMode === 'barometer' && this.latestRealHpa !== null) {
      raw_pressure = calibrateBarometerReading(this.latestRealHpa, this.state.barometerOffsetPa);
    } else {
      raw_pressure = Math.round(synthesizePressure(this.state.virtualFloor, physics) * 10) / 10;
    }

    // Synthesize raw RSSI for APs
    const raw_rssi = synthesizeRssi(
      this.state.virtualX,
      this.state.virtualY,
      this.state.virtualFloor,
      this.building.aps || [],
      physics,
    );

    // HARD RULE: Only { device_id, raw_pressure, raw_rssi }
    const payload: HeartbeatPayload = {
      device_id: this.deviceId,
      raw_pressure,
      raw_rssi,
    };

    try {
      await sendHeartbeat(this.serverUrl, this.deviceToken, payload);
      this.state.lastSentTimestamp = Date.now();
      this.state.totalSentCount++;
      this.state.lastPressure = raw_pressure;
      this.state.lastRssi = raw_rssi;
      this.state.isOffline = false;
      this.state.offlineError = null;
    } catch (err: unknown) {
      // Offline handling: mark offline, drop unsent heartbeat (never backfill stale data)
      this.state.isOffline = true;
      this.state.offlineError = err instanceof Error ? err.message : 'Network error';
    }

    this.notify();
  }

  private startBarometer() {
    try {
      Barometer.isAvailableAsync().then(available => {
        if (!available) {
          console.warn('Barometer sensor not available on this device.');
          return;
        }
        Barometer.setUpdateInterval(1000);
        this.barometerSubscription = Barometer.addListener(data => {
          this.latestRealHpa = data.pressure;
        });
      }).catch(err => {
        console.warn('Error checking barometer availability:', err);
      });
    } catch (err) {
      console.warn('Barometer init failed:', err);
    }
  }

  private stopBarometer() {
    if (this.barometerSubscription) {
      this.barometerSubscription.remove();
      this.barometerSubscription = null;
    }
    this.latestRealHpa = null;
  }

  public subscribe(listener: HeartbeatListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  public getState(): HeartbeatState {
    return { ...this.state };
  }

  private notify() {
    const copy = { ...this.state };
    for (const listener of this.listeners) {
      try {
        listener(copy);
      } catch (err) {
        console.error('Error in heartbeat listener:', err);
      }
    }
  }

  public destroy() {
    this.stop();
    this.stopBarometer();
    this.listeners.clear();
  }
}

export const heartbeatEngine = new HeartbeatEngine();
