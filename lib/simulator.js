const { idealRssi } = require('./physics');

// Ground truth stays in a private field. The only data crossing into the backend
// on a tick is device_id + raw_pressure + raw_rssi. Controls use truth internally.
class Simulator {
  #occupants = new Map();
  #offline = new Set();
  constructor(building, config, onHeartbeat, random = Math.random) {
    this.building = building;
    this.config = config;
    this.onHeartbeat = onHeartbeat;
    this.random = random;
    this.reset();
  }
  reset() {
    this.#offline.clear();
    this.#occupants.clear();
    for (let i = 1; i <= this.config.DEVICE_COUNT; i++) {
      const id = `D${String(i).padStart(3, '0')}`;
      this.#occupants.set(id, {
        floor: 1 + Math.floor(this.random() * this.building.floors),
        x: this.random() * this.building.grid_size_m,
        y: this.random() * this.building.grid_size_m,
        silent: this.config.GHOST_DEVICE_IDS.includes(id),
      });
    }
  }
  noise(magnitude) { return (this.random() * 2 - 1) * magnitude; }
  tick() {
    for (const [device_id, person] of this.#occupants) {
      if (person.silent) continue;
      const raw_pressure = this.building.reference_pressure_pa
        - person.floor * this.building.floor_height_m * this.config.PRESSURE_PER_METER
        + this.noise(this.config.PRESSURE_NOISE_PA);
      const raw_rssi = Object.fromEntries(this.building.aps.filter(ap => !this.#offline.has(ap.id)).map(ap => [
        ap.id, idealRssi(person.x, person.y, person.floor, ap, this.config) + this.noise(this.config.RSSI_NOISE_DB),
      ]));
      this.onHeartbeat({ device_id, raw_pressure, raw_rssi });
    }
  }
  goSilent(id) { this.#occupants.get(id).silent = true; }
  apDown(id) { this.#offline.add(id); }
  powerOutage(floor) {
    this.building.aps.filter(ap => ap.floor === floor).forEach(ap => this.apDown(ap.id));
    // This scenario models simultaneous AP and handset communication loss.
    for (const person of this.#occupants.values()) if (person.floor === floor) person.silent = true;
  }
}

module.exports = { Simulator };
