# Ember — indoor fire occupant localization prototype

A Node.js + Express + Socket.IO backend and a separate, no-build HTML/CSS/JS dashboard. The simulator synthesizes raw sensor measurements; the backend actually estimates floor and position. **This is a local classroom demo, not a validated emergency or rescue system.**

## Run

For the Android app and backend together, follow [Run and test the backend with the mobile app](docs/RUN_BACKEND_AND_MOBILE.md). It includes PowerShell commands, phone networking, Expo/APK options, and the heartbeat test sequence.

Node.js 20 or newer is required.

```sh
npm install && npm start
```

For Windows PowerShell versions that do not support `&&`, run `npm install` and `npm start` on separate lines. Open http://127.0.0.1:3000. The server binds only to localhost. There is no authentication or hardware integration. Stop with Ctrl+C. `PORT` can override the configured port.

```sh
npm test
```

Tests cover floor conversion, RSSI nearest neighbors, missing APs, raw-only payloads, bounded synthetic localization error, status precedence, frozen positions, reset, validation, HTTP scenarios and real Socket.IO delivery.

## Data boundary and computation

1. `lib/building.js` generates `building.json` once: six 20 × 20 m floors, three fixed APs per floor at (2,2), (18,2), (10,18). Existing AP coordinates are retained on later starts. A mismatch with configured building dimensions fails clearly; delete the generated building file to regenerate after a dimension change.
2. Before listening for requests, it regenerates and saves `fingerprint_map.json`: 11 × 11 samples per floor, 726 total, with an ideal RSSI reading from all 18 APs at each point. This is an occupant-independent synthetic installer survey.
3. `lib/simulator.js` keeps 40 true home locations in a private field. It sends **only** `{ device_id, raw_pressure, raw_rssi }` on every heartbeat. No ground-truth endpoint exists. D037–D040 deliberately never transmit. All other occupants remain at their assigned home positions until reset.
4. `lib/localization.js` calculates `round((reference_pressure_pa - raw_pressure) / (PRESSURE_PER_METER * floor_height_m))`. A floor outside the building is unknown, not clamped. The specified convention places floor 1 at 4 m above the reference, floor 6 at 24 m.
5. Position estimation filters survey points to the pressure-derived floor and minimizes `sqrt(sum((live_RSSI - survey_RSSI)^2))` over APs present in both vectors. The nearest point supplies `(x,y)`. No overlap returns no position, never an arbitrary first grid point. Offline APs are excluded. The confidence field is the raw match distance in dB: lower is better, **not** a probability. Matched AP count is shown because residuals across different AP counts are not directly comparable.

RSSI follows `A - 10 * PATH_LOSS_EXPONENT * log10(max(horizontal_distance, 0.1)) - abs(device_floor - ap_floor) * FLOOR_ATTENUATION_DB`. Floor loss models vertical signal bleed separately from horizontal distance. Runtime noise is uniform ±4 dB; pressure noise is uniform ±3 Pa. The survey uses zero noise. Using the same model for survey and simulation intentionally makes this an idealized demonstration, not evidence of real-world accuracy.

## Configuration

All physical and timing constants are in `config.js`:

| Constant | Default | Meaning |
| --- | --- | --- |
| `PRESSURE_PER_METER` | 12 Pa/m | Near-sea-level approximation; weather and temperature affect actual pressure gradients |
| `PATH_LOSS_EXPONENT` | 3 | Indoor attenuation exponent |
| `A` | −40 dBm | Calibrated signal at 1 m |
| `FLOOR_ATTENUATION_DB` | 15 dB | Attenuation per intervening floor |
| `REFERENCE_PRESSURE_PA` | 101325 Pa | Fixed ground reference sensor |
| `FLOOR_HEIGHT_M` | 4 m | Height per floor |
| `FLOORS`, `GRID_SIZE_M` | 6, 20 m | Building dimensions |
| `FINGERPRINT_STEP_M` | 2 m | Survey grid spacing |
| `PRESSURE_NOISE_PA`, `RSSI_NOISE_DB` | 3, 4 | Symmetric uniform sensor noise bounds |
| `HEARTBEAT_INTERVAL_MS` | 2000 | Simulator sample interval |
| `HEARTBEAT_TIMEOUT_SECONDS` | 8 | Silence threshold, strictly greater than this interval |
| `SOS_WINDOW_SECONDS` | 30 | SOS priority duration |
| `STATE_INTERVAL_MS` | 1000 | Live status update interval |
| `DEVICE_COUNT`, `GHOST_DEVICE_IDS` | 40, D037–D040 | Roster size and intentionally never-seen devices |

Restart after changing configuration. Session state is in memory and resets on restart. The building and fingerprint map are the persisted artifacts.

## Status and location semantics

Priority: **safe → active_sos → unaccounted / heartbeat_lost → active or location_unknown**. Evacuation persists until reset, even after a subsequent SOS. An SOS expires after 30 seconds; if its device has gone silent, it then becomes heartbeat_lost. A never-seen device that sends an SOS is no longer unaccounted; it can still lack a location.

Heartbeat loss preserves the last computed floor, coordinates and match distance. Timestamps remain unchanged and the UI shows elapsed time. A device with an invalid pressure-derived floor or no common AP readings is `location_unknown`. It is not a never-seen ghost.

AP offline is infrastructure state, separate from occupant state. Its floor is amber unless an SOS makes it red. Devices are never converted to unaccounted because an AP failed. The connected AP is an **inferred association**, the strongest online AP in the latest readings, because the specified payload has no actual association field. After an AP fails, this label can fall back to another AP from the latest scan; position is recomputed only on the next heartbeat.

True ghosts have no known floor or position and appear in the **Unlocated roster**, not on an invented floor. The top-level unaccounted count remains visible even if all located floors are green. Floor green means no known local warnings; it does not certify that the whole building is safe.

The dashboard includes illustrative room layouts for all six floors: reception/visitor services, workspaces, training, research, administration, and operations. Each plan shows numbered rooms, a main corridor, two stairwells, restrooms, door swings, and furniture outlines. Plans are stored in `building.json` under `floor_plans`; existing building files gain default plans on startup without changing AP coordinates. Edit the room metadata and restart to customize labels or geometry. The plans use the same meter coordinates as the occupant estimates. They add visual context only: wall geometry does not change the specified RSSI formula, and the backend continues to report floor and coordinates rather than claiming verified room-level accuracy.

## Firefighter command view

The default dashboard is designed for a ground-level incident command screen. Large cards show Active SOS, Signal lost, Unaccounted, and Confirmed safe. The “Needs attention” rail lists SOS and lost-signal occupants first; clicking a person jumps to their floor and highlights their marker. Floor buttons show alert counts, and the full roster and demo controls stay collapsed. Occupants are identified by human-readable names from `config.js` with device IDs retained as secondary identifiers, so firefighters can call names aloud and watch for a response. Name labels are roster metadata; they do not enter the raw sensor payload.

The “Open on phone” QR uses a public HTTPS field URL. The hosted field view is read-only and polls the latest signed snapshot from the command station; it shows a stale-feed banner if the station stops publishing. The command station keeps all controls and the simulator. Set `PUBLIC_DASHBOARD_URL` and `PUBLISH_TOKEN` in `.env` to enable publishing. The deployment scaffold is in `hosted/`, with an R2-backed latest snapshot and a static phone client. A successful hosted deployment is required before the QR can be scanned from mobile data; localhost cannot work from a phone outside the computer.

The floor plan fills the available map panel with larger room labels and occupant markers. At tablet widths, floor selection moves above the map to leave more space for it. The dashboard uses only the 2-D floor plan; the 3-D view and its rendering dependency have been removed. On the local dashboard, app downloads are available from “Occupant mobile app” in the footer, without a popup interrupting the incident view on load.

## Demo scenarios

The dashboard includes controls for every action. Each POST accepts JSON with `Content-Type: application/json`.

| Scenario | Endpoint | Body / behavior |
| --- | --- | --- |
| Normal | `POST /simulate/reset` | `{}` restores APs and assigns new private home positions; 36 active devices and 4 ghosts |
| SOS | `POST /simulate/sos` | `{"device_id":"D001"}`; red floor and SOS count for 30 s |
| Heartbeat loss | `POST /simulate/go-silent` | `{"device_id":"D002"}`; wait >8 s, last position freezes |
| Confirm evacuation | `POST /simulate/evacuate` | `{"device_id":"D003"}`; safe count increases, simulator stops its heartbeats |
| Ghost / unaccounted | `POST /simulate/reset` | D037–D040 are absent from every heartbeat; inspect Unlocated roster |
| AP failure | `POST /simulate/ap-down` | `{"ap_id":"AP-1"}`; removes this AP from future readings and flags its floor |
| Floor power outage | `POST /simulate/power-outage` | `{"floor":2}`; all three floor APs go offline and occupants truly on that floor stop heartbeats |

Power outage is explicitly a **combined infrastructure and device communication failure scenario**. Real battery-powered phones would not necessarily stop transmitting during mains loss. Other floors still transmit, without the failed AP readings. Reset restores the entire session.

Example in PowerShell:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/simulate/sos -Method Post -ContentType 'application/json' -Body '{"device_id":"D001"}'
```

## Public API and live protocol

- `GET /api/summary`: `{ expected, safe, unaccounted, active_sos }`. These are separate metrics, not an exhaustive partition: active and heartbeat_lost occupants are not separate cards.
- `GET /api/floors`: floor colors, device counts and offline AP counts.
- `GET /api/floors/:floor`: computed device locations, raw readings, match distances, statuses, timestamps and floor APs.
- `GET /api/building` or `/building.json`: fixed public layout.
- `GET /api/state`: complete public state, including unlocated devices.
- `POST /api/heartbeat`: strictly accepts only `device_id`, `raw_pressure`, `raw_rssi`; rejects precomputed floor/position fields and unknown devices/APs. This optional ingress also enables manual raw-sensor experiments.
- Socket.IO namespace `/live`: connect with `io('/live')`. This is the Socket.IO protocol, not a plain native-WebSocket URL. The client supports WebSocket upgrade and polling fallback. Receive `snapshot` on connection/reset and `state_diff` thereafter. Diffs contain only changed devices/APs plus aggregates, server time, and a monotonically increasing revision. The client merges records by ID, requests `resync` on a revision gap, and receives a fresh snapshot on reconnect.

### Device API (`/api/device/*`)

Used by the "Ember Responder SOS" mobile app. All routes are CORS-enabled from any origin and strictly require the `x-device-token` header matching the server's configured `DEVICE_TOKEN` (rejects with 401 otherwise).

- `POST /api/device/heartbeat`: strictly accepts `{ device_id, raw_pressure, raw_rssi }`. Raw measurements only; backend calculates floor and coordinates.
- `POST /api/device/sos`: `{"device_id":"D005"}`. Triggers an immediate active SOS event and broadcasts via Socket.IO diff.
- `POST /api/device/sos-cancel`: `{"device_id":"D005"}`. Cancels an active SOS within the 15-second grace period (`SOS_CANCEL_GRACE_SECONDS`). Returns 400 if expired or not active.
- `POST /api/device/claim`: `{"device_id":"D005"}`. Marks the roster device as phone-controlled; `Simulator.tick()` stops generating heartbeats for it to avoid duplicate packets.
- `POST /api/device/release`: `{"device_id":"D005"}`. Returns the device back to the simulator for automated heartbeats.
- `GET /api/device/:id/status`: returns this device's current computed status, floor, x, y coordinates, match distance in dB, matched AP count, connected AP, and last heartbeat timestamp.

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Network interface to bind. Set to `0.0.0.0` for local area network (LAN) phone demos. |
| `PORT` | `3000` | HTTP and WebSocket listening port. |
| `DEVICE_TOKEN` | *(empty)* | Secret token required in `x-device-token` header for all `/api/device/*` requests. |
| `PUBLIC_DASHBOARD_URL` | *(empty)* | Optional HTTPS field mirror URL for cloud publishing. |
| `PUBLISH_TOKEN` | *(empty)* | Bearer token for cloud publisher updates. |

The static dashboard lives in `public/`, served by Express without bundling. It uses SVG for APs and computed device dots, floor selection, status lists, outage banners, connection state and scenario controls. Overlapping grid estimates use concentric rings instead of fabricated position jitter. No refresh is required. It has no external data or hardware dependencies.

## Explaining the technical contribution

The important distinction is **measurement synthesis versus answer synthesis**. The simulator needs a private physical position to generate pressure and WiFi measurements. The backend receives no such position. It must invert the pressure model and solve a nearest-neighbor search against an independent survey. Read `lib/building.js` (survey generation), then `lib/localization.js` (pressure inversion and signal-space matching), and finally the raw-only schema enforcement in `lib/state.js`.

Limitations include grid quantization, possible ambiguity with too few APs, identical survey/runtime propagation assumptions, no sensor bias or drift, no wall-aware propagation model, no real controller association, and no validation against actual building measurements. Those are useful next experiments, not claims made by this prototype.
