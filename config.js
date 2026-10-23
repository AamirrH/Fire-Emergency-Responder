// All physical and demo timing constants live here. Floors are numbered 1–6;
// floor 1 is 4 m above the reference sensor, matching the supplied model.
module.exports = Object.freeze({
  PORT: 3000,
  FLOORS: 6,
  FLOOR_HEIGHT_M: 4,
  GRID_SIZE_M: 20,
  FINGERPRINT_STEP_M: 2,
  REFERENCE_PRESSURE_PA: 101325,
  PRESSURE_PER_METER: 12, // Near-sea-level approximation; temperature/weather dependent in reality.
  A: -40, // RSSI at 1 m, dBm.
  PATH_LOSS_EXPONENT: 3,
  FLOOR_ATTENUATION_DB: 15,
  PRESSURE_NOISE_PA: 3,
  RSSI_NOISE_DB: 4,
  DEVICE_COUNT: 40,
  OCCUPANT_NAMES: [
    'Aarav Mehta', 'Aisha Khan', 'Alex Morgan', 'Ananya Rao', 'Arjun Patel',
    'Beatrice Lewis', 'Carlos Mendes', 'Chloe Martin', 'Daniel Kim', 'Diya Shah',
    'Elena Garcia', 'Ethan Brooks', 'Fatima Noor', 'Grace Wilson', 'Hannah Lee',
    'Ibrahim Ali', 'Isla Turner', 'Jack Carter', 'Jaya Nair', 'Jonas Weber',
    'Kavya Iyer', 'Leo Thompson', 'Liam Chen', 'Maya Singh', 'Mia Johnson',
    'Nikhil Das', 'Noah Williams', 'Olivia Brown', 'Omar Haddad', 'Priya Kapoor',
    'Ravi Menon', 'Riya Bose', 'Sam Taylor', 'Sara Rossi', 'Sofia Martinez',
    'Theo Evans', 'Uma Krishnan', 'Victor Nguyen', 'Will Harris', 'Yuki Sato',
  ],
  GHOST_DEVICE_IDS: ['D037', 'D038', 'D039', 'D040'],
  HEARTBEAT_INTERVAL_MS: 2000,
  HEARTBEAT_TIMEOUT_SECONDS: 8,
  SOS_WINDOW_SECONDS: 30,
  SOS_CANCEL_GRACE_SECONDS: 15,
  STATE_INTERVAL_MS: 1000,
});
