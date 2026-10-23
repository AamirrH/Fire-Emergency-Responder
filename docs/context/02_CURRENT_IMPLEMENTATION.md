# Current backend and dashboard implementation

Code inspected on 22 October 2026; repository HEAD at inspection: `63cfde5` (`fix: include hosted dashboard as regular folder`). This file describes this repository, not the separately developed mobile app. Paths below are relative to the repository root.

## Data source and software stack

**All sensor inputs in the built-in demonstration are simulated.** The team chose this because collecting real readings requires hardware setup, calibration, and building surveying outside its current expertise. Real calculation code processes those synthetic readings.

| Component | Actual implementation |
| --- | --- |
| Runtime | Node.js; package requires version 20 or newer |
| Backend | JavaScript, Express 4; `server.js` |
| Local live delivery | Socket.IO 4, namespace `/live` |
| Dashboard | Plain HTML, CSS, JavaScript and SVG; no React build |
| Localization | Custom pressure conversion and nearest-neighbor fingerprint functions |
| State | JavaScript Maps in process memory |
| Reference data | `building.json` and generated `fingerprint_map.json` |
| Configuration | `config.js`; `dotenv` for environment configuration |
| QR | `qrcode`; HTTPS field-view URL |
| Hosted companion | JavaScript worker plus R2-compatible `BUCKET` storage binding |
| Tests | Built-in `node:test`, `socket.io-client`, `jsqr`, `pngjs` |

Dependency ranges in `package.json` include Express `^4.21.2`, Socket.IO `^4.8.1`, qrcode `^1.5.4`, and dotenv `^18.0.6`; the lockfile records resolved versions. FastAPI, Python services, React, Redis, PostgreSQL, SQLite, MQTT, Docker Compose, and Three.js are not current application dependencies. Python was used to read supplied documents for this context pack, not as the project backend.

## Module responsibilities

| Path | Responsibility |
| --- | --- |
| `config.js` | Dimensions, physical assumptions, names, timing, ghost-device IDs |
| `lib/building.js` | Load/create building; generate independent reference grid |
| `lib/floorplans.js` | Illustrative room, corridor, doorway and stair layout definitions |
| `lib/physics.js` | Ideal RSSI propagation formula |
| `lib/simulator.js` | Private synthetic positions; emit raw readings; scenario failures |
| `lib/localization.js` | Pressure-to-floor and RSSI nearest-neighbor functions |
| `lib/state.js` | Validation, named roster, estimated positions, statuses, AP state and summary |
| `server.js` | Routes, timers, Socket.IO snapshots/diffs, local server and optional publisher |
| `lib/cloud.js` | Hosted snapshot upload and QR generation |
| `public/index.html`, `styles.css`, `app.js`, `map.js` | Command interface, live updates, SVG map and presentation of room estimates |
| `hosted/worker.js`, `hosted/public/`, `hosted/build.mjs` | Read-only phone mirror and packaging |
| `test/` | Localization/state, HTTP/Socket.IO, QR and hosted-worker checks |
| `assets/` | Earlier preview and QR-check images; not proof of current UI or hardware operation |
| `releases/` | Packaged site archive |

The `hosted` folder is now an ordinary tracked folder. The previous nested-repository GitHub 404 issue has been corrected in the inspected commit.

## What the simulator generates

- Six floors, 20 m × 20 m, each with three APs at `(2,2)`, `(18,2)`, `(10,18)`; 18 APs total.
- Forty occupants, `D001`–`D040`, with synthetic names in `config.js`.
- A randomly assigned true floor and coordinate for each occupant at initialization/reset. These positions are private to the simulator and remain stationary between resets. There is no random-walk evacuation animation.
- `D037`–`D040` never transmit; normally 36 devices produce readings.
- Heartbeats every 2 seconds; state broadcasts every 1 second.
- Pressure = `101325 - floor * 4 * 12 + uniform noise from -3 to +3 Pa`.
- RSSI = `-40 - 30*log10(max(horizontal_distance, 0.1)) - 15*abs(device_floor - ap_floor) + noise from -4 to +4 dB`.
- Readings include every online simulated AP, including APs on other floors with attenuation.

The reference grid covers coordinates 0,2,…,20 along each axis: 121 points per floor, 726 total. Every point stores ideal readings for all 18 APs. Generation is independent of occupants' random home positions, but shares the propagation formula with the simulator. There is no real survey, wall-aware radio model, measured AP height model, or trained model.

## Processing and storage

```text
Private simulated true position
  -> synthetic raw pressure and RSSI
  -> shared heartbeat handler and validation
  -> pressure-derived floor
  -> fingerprint search limited to that floor
  -> estimated coordinates and signal residual
  -> state/status snapshot
  -> local Socket.IO dashboard
  -> optional HTTPS upload -> hosted read-only dashboard
```

The internal simulator calls `state.heartbeat()` directly. The HTTP `/api/heartbeat` route calls the same handler. It does not send its own readings over a network socket. Ground-truth coordinates are not sent to the estimator or exposed as a public API.

Only APs present in both vectors participate in matching; offline APs are filtered out. No shared APs means no position estimate. An out-of-range floor becomes `null`, not a forced valid floor. Missing pressure is rejected; no Wi-Fi-only fallback or temporal floor hysteresis exists.

The `confidence` value is the Euclidean RSSI residual in dB, **not a confidence percentage**. Matched AP count is returned too. Residuals using different numbers of APs should not be compared as equivalent confidence scores.

`connected_ap` is inferred as the strongest online AP in the available readings. It is not actual association data from a Wi-Fi controller. Names are a static device-to-name mapping, not authenticated enrollment. Room descriptions are calculated in the browser from the estimated coordinate and layout; they are not backend-certified room detections.

`building.json` is retained across starts and upgraded with plans if needed. `fingerprint_map.json` is regenerated at startup. Live positions, statuses, and safe confirmations are in memory and reset on restart. There is no historical incident database or durable audit trail. The hosted bucket stores a latest snapshot, not complete history.

## Exact status behavior

The code evaluates status in this order:

1. `safe` if explicitly marked evacuated; it stays safe until reset.
2. `active_sos` while the SOS age is at most 30 seconds, even if heartbeats have stopped.
3. `unaccounted` when the device has never produced an event and has no connected AP.
4. `heartbeat_lost` when more than 8 seconds have passed since the last heartbeat, or last event if no heartbeat exists.
5. `location_unknown` if current floor or position is unavailable; otherwise `active`.

This is session-based, not an emergency-session history model. A never-seen device with an SOS is no longer simply unaccounted. Silence retains the last calculated location and original timestamp. A new invalid/no-overlap reading can instead result in an unknown current location.

Floor colors are red for SOS, amber for lost/unknown-location warnings or offline APs, otherwise green. Unknown-floor ghosts appear separately and do not make an arbitrary floor amber. Green means no known warning on that floor, not that the building is cleared. The alert list orders SOS before lost signal before unknown location, differing from some early chat suggestions.

## User interface decisions and completed changes

The command view emphasizes Active SOS, Signal lost, Unaccounted, and Confirmed safe. Expected roster size is shown with the safety count. The attention list identifies people by name and lets the operator jump to their floor. Floor buttons, estimated room descriptions, last-signal ages, AP outage information, and an unknown-floor roster provide supporting context. Sensor details and demo controls are collapsed to reduce clutter.

The six illustrative plans represent reception/visitor services, workspaces, training, research, administration, and operations. They include labelled rooms, stairs, restrooms, corridors, and door openings. Geometry is illustrative, not a surveyed real building. Floor-plan display sizing was increased to use available panel width, capped at 900 px, while retaining square proportions. Occupant locations remain estimates.

The interactive 3-D feature was removed completely at the user's request. Do not use earlier screenshots of its panel as evidence of a current feature. No dedicated fingerprint-table viewer, automatic fire-alarm mode, fall detector, route planner, or descending/evacuating classifier is present.

## Existing interfaces

| Interface | Purpose |
| --- | --- |
| `GET /api/runtime` | Live transport, control capability, share configuration |
| `GET /api/building` or `/building.json` | Building and floor plans; `/api/building` also has demo configuration |
| `GET /api/state` | Full state including devices, APs, floor summaries and revision |
| `GET /api/summary` | Expected, safe, unaccounted, active SOS counts |
| `GET /api/floors`, `/api/floors/:floor` | Floor summary and floor details |
| `POST /api/heartbeat` | Raw telemetry ingress with strict validation |
| `POST /simulate/sos`, `/go-silent`, `/evacuate`, `/ap-down`, `/power-outage`, `/reset` | Paths after `/simulate/` trigger corresponding demo scenarios |
| `GET /api/share/status`, `/api/share/qr.png` | Publishing status and generated QR |
| Socket.IO `/live` | `snapshot`, `state_diff`; client can request `resync` |

The accepted heartbeat body has exactly these three fields:

```json
{"device_id":"D001","raw_pressure":101133,"raw_rssi":{"AP-10":-55,"AP-11":-68,"AP-12":-62}}
```

This is an illustrative accepted payload, not a measurement. Pressure is in Pa; AP keys must exist in the building; the device must exist in the roster. Extra keys, including a client-provided floor, name, timestamp, or SOS flag, are rejected. A Socket.IO namespace is not a plain WebSocket endpoint.

## QR and hosted view

The intended field view mirrors this same incident; it does not run another independent simulator. The local server optionally uploads state/building every 2 seconds to `PUT /api/ingest`, authorized with a bearer token. Despite comments saying “signed,” this is bearer-token authentication, not a separately signed payload. The worker stores `incident/latest.json` through its bucket binding.

The hosted client polls `/api/state` at roughly 1.5-second intervals between completed requests. Local clients receive Socket.IO pushes. Source age helps show stale data; the interface marks the feed stale beyond 6.5 seconds. Opening a QR link does not establish that an external deployment is live.

A public deployment was attempted earlier but not verified successful. This context task did not deploy or test public internet access. Treat public phone portability as code prepared / deployment unverified. Do not copy `.env` or publishing credentials into reports or shared context. A public occupant view would also need an intentional privacy/access-control policy before real use.

## Running and demonstrating

From the project directory, use `npm install`, then `npm start`, and open `http://127.0.0.1:3000`. `npm test` runs the automated suite. The backend and dashboard run together. There is no separate React development server.

The server binds to loopback (`127.0.0.1`). Its POST guard also restricts requests to local clients and checks the Origin when present. A physical phone cannot simply connect to the computer's LAN IP and use this API. Mobile integration needs deliberate networking and authentication work.

A truthful presentation sequence is: reset to 36 transmitting devices and four unlocated ghosts; select a named occupant; trigger SOS; make a device silent and wait more than 8 seconds (or until the 30-second SOS window expires if that device has SOS); demonstrate the retained location; switch off an AP; explicitly confirm someone safe; inspect the four ghosts; reset. A floor outage intentionally stops that floor's simulated transmissions as well as its APs. Battery-powered real phones do not inherently stop because mains electricity fails.

## Verification and results boundaries

The repository has 12 automated tests covering QR target decoding, hosted state mirroring and authorization, publisher failure handling, distinct roster names, floor math, fingerprint coverage, shared/missing AP matching, raw-only simulation, status/failure behavior, invalid payload rejection, synthetic noisy estimation, and HTTP/Socket.IO delivery. Earlier work in this chat recorded all 12 passing after allowing local networking for the integration test. A fresh run for this context handoff is recorded in file 04 if completed.

One test generates 120 seeded synthetic locations with the same model/noise assumptions, checks floor equality, and asserts mean coordinate error below 2 m. This is a test threshold, not a measured real-world accuracy claim. No exact current mean, field success rate, battery use, latency benchmark, rescue improvement, or human usability study is established here.

Major remaining work: real acquisition/survey, mobile contract and enrollment, controller/attendance feeds, persistent storage/history, authenticated roles, reference calibration, sensor/platform validation, and verified public hosting. Keep these separate from completed backend calculations and UI work.
