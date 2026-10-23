const { estimateFloor, estimatePosition } = require('./localization');

class OccupantState {
  constructor(building, fingerprints, config, clock = Date.now) {
    Object.assign(this, { building, fingerprints, config, clock });
    this.reset();
  }
  reset() {
    this.devices = new Map(Array.from({ length: this.config.DEVICE_COUNT }, (_, index) => {
      const device_id = `D${String(index + 1).padStart(3, '0')}`;
      return [device_id, { device_id, name: this.config.OCCUPANT_NAMES[index] || device_id, floor: null, position_estimate: null, confidence: null,
        matched_ap_count: 0, connected_ap: null, last_heartbeat: null, last_event: null,
        sos_at: null, evacuated_at: null, raw_pressure: null, raw_rssi: {} }];
    }));
    this.aps = new Map(this.building.aps.map(ap => [ap.id, { ...ap, online: true, offline_since: null }]));
  }
  validateHeartbeat(payload) {
    if (!payload || Object.keys(payload).sort().join(',') !== 'device_id,raw_pressure,raw_rssi') throw new Error('Heartbeat must contain only device_id, raw_pressure, raw_rssi.');
    if (!this.devices.has(payload.device_id)) throw new Error('Unknown device_id.');
    if (!Number.isFinite(payload.raw_pressure) || payload.raw_pressure <= 0) throw new Error('raw_pressure must be a positive finite number.');
    if (!payload.raw_rssi || typeof payload.raw_rssi !== 'object' || Array.isArray(payload.raw_rssi)) throw new Error('raw_rssi must be an AP-to-RSSI object.');
    for (const [id, value] of Object.entries(payload.raw_rssi)) {
      if (!this.aps.has(id) || !Number.isFinite(value)) throw new Error('Each RSSI must be finite and name a known AP.');
    }
  }
  strongestAp(rawRssi) {
    return Object.entries(rawRssi).filter(([id]) => this.aps.get(id)?.online).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }
  heartbeat(payload) {
    this.validateHeartbeat(payload);
    const device = this.devices.get(payload.device_id);
    const now = this.clock();
    const rawRssi = Object.fromEntries(Object.entries(payload.raw_rssi).filter(([id]) => this.aps.get(id).online));
    const floor = estimateFloor(payload.raw_pressure, this.building, this.config);
    Object.assign(device, { floor, ...estimatePosition(rawRssi, floor, this.fingerprints),
      raw_pressure: payload.raw_pressure, raw_rssi: rawRssi, connected_ap: this.strongestAp(rawRssi),
      last_heartbeat: now, last_event: now });
  }
  event(type, id) {
    const device = this.devices.get(id);
    if (!device) throw new Error('Unknown device_id.');
    device.last_event = this.clock();
    if (type === 'sos') device.sos_at = device.last_event;
    if (type === 'sos-cancel' || type === 'sos_cancel') {
      const graceMs = (this.config.SOS_CANCEL_GRACE_SECONDS || 15) * 1000;
      if (device.sos_at === null) throw new Error('No active SOS to cancel.');
      if (device.last_event - device.sos_at > graceMs) throw new Error('SOS cancel grace period expired.');
      device.sos_at = null;
    }
    if (type === 'evacuate') device.evacuated_at = device.last_event;
  }
  apDown(id) {
    const ap = this.aps.get(id);
    if (!ap) throw new Error('Unknown ap_id.');
    ap.online = false;
    ap.offline_since = this.clock();
    for (const device of this.devices.values()) device.connected_ap = this.strongestAp(device.raw_rssi);
  }
  status(device, now) {
    if (device.evacuated_at !== null) return 'safe';
    if (device.sos_at !== null && now - device.sos_at <= this.config.SOS_WINDOW_SECONDS * 1000) return 'active_sos';
    if (device.last_event === null && device.connected_ap === null) return 'unaccounted';
    if (now - (device.last_heartbeat ?? device.last_event) > this.config.HEARTBEAT_TIMEOUT_SECONDS * 1000) return 'heartbeat_lost';
    return device.floor === null || device.position_estimate === null ? 'location_unknown' : 'active';
  }
  snapshot() {
    const now = this.clock();
    const devices = [...this.devices.values()].map(device => ({ ...device, raw_rssi: { ...device.raw_rssi }, status: this.status(device, now) }));
    const aps = [...this.aps.values()].map(ap => ({ ...ap }));
    const summary = { expected: devices.length, safe: 0, unaccounted: 0, active_sos: 0 };
    for (const device of devices) if (Object.hasOwn(summary, device.status)) summary[device.status]++;
    const floors = Array.from({ length: this.building.floors }, (_, i) => {
      const floor = i + 1;
      const occupants = devices.filter(device => device.floor === floor);
      const offline = aps.filter(ap => ap.floor === floor && !ap.online).length;
      const alert = occupants.some(device => device.status === 'active_sos');
      const warning = offline > 0 || occupants.some(device => ['heartbeat_lost', 'unaccounted', 'location_unknown'].includes(device.status));
      return { floor, color: alert ? 'red' : warning ? 'amber' : 'green', device_count: occupants.length, offline_aps: offline };
    });
    return { server_time: now, summary, floors, devices, aps, unlocated_count: devices.filter(d => d.floor === null).length };
  }
}

module.exports = { OccupantState };
