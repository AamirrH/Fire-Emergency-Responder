import { io, Socket } from 'socket.io-client';
import { DeviceStatusResponse } from './api';

export interface PublicSnapshot {
  server_time: number;
  revision: number;
  summary: {
    expected: number;
    safe: number;
    unaccounted: number;
    active_sos: number;
  };
  floors: Array<{
    floor: number;
    color: 'red' | 'amber' | 'green';
    device_count: number;
    offline_aps: number;
  }>;
  devices: DeviceStatusResponse[];
  aps: Array<{
    id: string;
    floor: number;
    x: number;
    y: number;
    online: boolean;
    offline_since: number | null;
  }>;
  unlocated_count: number;
}

export interface StateDiff {
  server_time: number;
  revision: number;
  summary: PublicSnapshot['summary'];
  floors: PublicSnapshot['floors'];
  devices: DeviceStatusResponse[];
  aps: PublicSnapshot['aps'];
  unlocated_count: number;
}

export type StatusListener = (device: DeviceStatusResponse | null) => void;
export type ConnectionListener = (connected: boolean, message: string) => void;

export class LiveSocketManager {
  private socket: Socket | null = null;
  private state: PublicSnapshot | null = null;
  private targetDeviceId: string | null = null;
  private statusListeners = new Set<StatusListener>();
  private connectionListeners = new Set<ConnectionListener>();

  public connect(serverUrl: string, deviceId: string) {
    this.targetDeviceId = deviceId;
    this.disconnect();

    const clean = serverUrl.replace(/\/+$/, '');
    const liveUrl = `${clean}/live`;

    this.socket = io(liveUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 5000,
    });

    this.socket.on('connect', () => {
      this.notifyConnection(true, 'Live');
    });

    this.socket.on('disconnect', (reason) => {
      this.notifyConnection(false, `Offline (${reason})`);
    });

    this.socket.on('connect_error', (error) => {
      this.notifyConnection(false, `Connection error: ${error.message}`);
    });

    // Handle full initial snapshot or reset
    this.socket.on('snapshot', (snapshot: PublicSnapshot) => {
      this.state = snapshot;
      this.notifyDevice();
    });

    // Handle incremental diffs with revision gap check (mirrors public/app.js)
    this.socket.on('state_diff', (diff: StateDiff) => {
      if (!this.state || diff.revision !== this.state.revision + 1) {
        // Revision gap detected: request clean snapshot from server
        this.socket?.emit('resync');
        return;
      }

      // Merge updated devices
      const deviceMap = new Map(diff.devices.map(d => [d.device_id, d]));
      const mergedDevices = this.state.devices.map(existing => deviceMap.get(existing.device_id) || existing);

      // Merge updated APs
      const apMap = new Map(diff.aps.map(ap => [ap.id, ap]));
      const mergedAps = this.state.aps.map(existing => apMap.get(existing.id) || existing);

      this.state = {
        ...diff,
        devices: mergedDevices,
        aps: mergedAps,
      };

      this.notifyDevice();
    });
  }

  public setDeviceId(deviceId: string) {
    this.targetDeviceId = deviceId;
    this.notifyDevice();
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    if (this.state && this.targetDeviceId) {
      const found = this.state.devices.find(d => d.device_id === this.targetDeviceId) || null;
      listener(found);
    }
    return () => this.statusListeners.delete(listener);
  }

  public subscribeConnection(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener);
    listener(this.socket?.connected ?? false, this.socket?.connected ? 'Live' : 'Connecting...');
    return () => this.connectionListeners.delete(listener);
  }

  private notifyDevice() {
    if (!this.targetDeviceId || !this.state) return;
    const device = this.state.devices.find(d => d.device_id === this.targetDeviceId) || null;
    for (const listener of this.statusListeners) {
      try {
        listener(device);
      } catch (err) {
        console.error('Error in status listener:', err);
      }
    }
  }

  private notifyConnection(connected: boolean, message: string) {
    for (const listener of this.connectionListeners) {
      try {
        listener(connected, message);
      } catch (err) {
        console.error('Error in connection listener:', err);
      }
    }
  }

  public disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.state = null;
  }
}

export const liveSocket = new LiveSocketManager();
