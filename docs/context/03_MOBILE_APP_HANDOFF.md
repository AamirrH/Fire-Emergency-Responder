# Mobile app context and future integration

## What is known

The user says a friend has built the occupant app. The app repository, screenshots, dependency versions, implemented endpoints, and tests were not provided for this handoff. Its existence is user-reported; its implementation is not verified here. This is a placeholder for combining both halves later, not an assertion that the app is unfinished.

**The current backend demonstration uses simulated readings because the team does not currently know how to perform real hardware acquisition.** Keep that statement in the combined report unless the mobile owner supplies concrete evidence of actual sensor use and an updated scope is agreed.

There are two different phone experiences:

| Experience | User | Purpose |
| --- | --- | --- |
| Occupant SOS app | Person inside the building | Enrollment, telemetry, SOS, own device state |
| QR field dashboard | Firefighter/team lead | Read the same live incident information as the command screen |

The QR view is not the occupant app and does not supply sensor data.

## Design discussed in the Claude chats, not verified app stack

The later discussion recommends native Android with Kotlin and Jetpack Compose, SensorManager pressure readings, WifiManager scan data, a foreground service, OkHttp WebSocket transport, enrollment over REST, optional FCM emergency wake-up, local token storage, reconnection/buffering, and a simulation mode. Android Studio/SDK and a test phone or emulator were discussed. Earlier prompts also describe a browser-based mobile simulator view; neither prompt proves what the friend built.

Intended onboarding is organization selection/code, authenticated user identity, device enrollment, permissions, then background telemetry. Normal intervals of 30–60 seconds and emergency intervals of 5–10 seconds were proposed. SOS cancellation within 5 seconds, fall detection, and cellular fallback were discussed as additional features. iOS was treated as outside the proposed initial native-app scope.

Treat Android permission rules, scan throttling, storage recommendations, FCM behavior, and background guarantees in those historical chats as items to verify against the app's actual platform and versions. Do not copy them as current platform documentation or claim continuous operation without testing.

## Contract differences that must be reconciled

| Chat/mobile proposal | Backend today | Integration decision needed |
| --- | --- | --- |
| Organization and login enrollment | Fixed `D001`–`D040` roster | Add authenticated device/person/org records or agree a controlled demo mapping |
| `pressure_hpa` | `raw_pressure` in Pa | Explicit conversion: 1 hPa = 100 Pa |
| BSSID scan entries | `raw_rssi` keyed by configured AP IDs | Maintain BSSID-to-AP mapping; define unknown-AP handling |
| `org_id`, timestamp, SOS, battery, network fields | Exactly three keys allowed | Version the schema or introduce an adapter; do not send proposal payload unchanged |
| Plain WebSocket app transport | HTTP telemetry route; Socket.IO used for dashboard output | Agree actual ingress protocol; these protocols are not interchangeable |
| Missing pressure sensor | Positive finite pressure required | Define simulated mode or an explicit unknown/fallback path |
| Real phone over LAN/internet | Loopback binding and local-only POST guard | Provide reachable authenticated ingress and deployment configuration |
| SOS in heartbeat | Separate local `/simulate/sos` control | Implement appropriate authenticated mobile event interface |
| Buffered telemetry with sample timestamps | Server stamps receipt time | Prevent old queued readings from appearing as live locations |
| Variable heartbeat interval | Fixed 2 s simulation and 8 s silence threshold | Coordinate timing; a 30–60 s app interval would otherwise look repeatedly lost |
| App data replacing simulation | Simulator starts automatically | Select data-source mode; prevent simulator overwriting the same real-device record |
| Cloud receiving device signals | Hosted worker accepts complete computed snapshots | Do not expose the publisher secret to the occupant app |

The hosted mirror is not a mobile-telemetry backend. It currently accepts full incident uploads from the trusted station and serves read-only dashboard data.

## Ask the mobile owner for this evidence

1. Repository or source archive and commit/version; their actual name and contribution.
2. Stack, Android minimum/target versions, build/run instructions and tested devices.
3. Screenshots of enrollment, main screen, SOS, permission denial, offline state and simulation controls.
4. List of implemented versus planned features, especially organization selection, login, foreground service, SOS, buffering, and emergency cadence.
5. Exact telemetry/SOS JSON, pressure units, timestamps, AP identifiers, transport, routes, responses, and authentication mechanism. Share examples with tokens removed.
6. For every displayed reading, whether it is actual, simulated, cached, or a placeholder; evidence for any sensor claim.
7. No-barometer/no-Wi-Fi/denied-permission behavior, phone lock/background behavior, network-loss handling and any battery tests.
8. Whether it has connected to this exact backend; reproducible end-to-end test steps and outcomes.

## Merge checklist when those details arrive

- Record source version and collection date here; replace proposed-stack descriptions only where supported.
- Agree identity mapping, units, timestamps, freshness, AP mapping, schema, and status names.
- Decide a controlled demo versus real sensor mode explicitly, including how the simulator is disabled for external devices.
- Test one enrolled device end to end: telemetry -> estimate -> named marker -> SOS -> silence -> last-known location -> confirmed safety.
- Test stale buffered records, reconnect, missing permissions, unknown APs and missing pressure.
- Update the root [CONTEXT.md](../../CONTEXT.md), report evidence, and architecture diagram to reflect the actual integrated system.

Do not assign any teammate a specific implementation contribution until the team confirms it. Do not assert automatic rescue dispatch or “help is on the way” solely because the app sent an SOS; transmission and responder acknowledgement are different events.
