# Fire Emergency Responder project context

Last reviewed: 22 October 2026. Audience: the teammate preparing the presentation and academic report. This is a context handoff, not the final report.

## Read this first: we use simulated data

**The current backend and dashboard use simulated data, not actual readings from phones, barometers, Wi-Fi access points, or building attendance systems.** Collecting actual readings involves hardware setup, sensor access, calibration, and surveying a real building. The team does not currently know how to carry out that hardware work, so simulation was deliberately chosen to develop and demonstrate the software.

The simulator creates raw pressure and Wi-Fi signal-strength readings. The backend then performs the floor calculation, fingerprint matching, and status classification on those readings. The location answers are calculated, not directly copied from the simulator's hidden positions. However, the fingerprint reference dataset is also synthetic and uses the same mathematical model. This demonstrates software behavior under controlled assumptions; it does not establish accuracy in a real building or an actual fire.

The user reports that a friend has built the occupant mobile app separately. Its code, actual stack, data source, and integration results have not yet been supplied. Do not claim that the mobile app reads real sensors or is integrated with this backend until its context is available.

## What we are trying to build

The project aims to help firefighters answer three questions quickly: who may still be inside a building, which floor they are on, and approximately where on that floor to search. It combines vertical location from pressure, horizontal location from Wi-Fi signal fingerprints, and an occupant roster for accountability.

The intended responder interface is a screen at the ground-level fire command point. It prioritizes names, floors, SOS alerts, missing signals, and last-known locations so an incident commander can direct teams. Names matter because firefighters can call out to an occupant. A QR link is intended to let a firefighter carry the same live dashboard on a phone.

The full concept also includes an occupant app, enrollment linking devices to people and organizations, Wi-Fi controller records, and badge-in/out information. Those are broader design elements; their implementation status is listed in the supporting files.

## Share this context pack

Send this file **and the entire `docs/context/` folder** to your friend. The links below are relative so they remain usable when the pack is copied together.

| File | What it explains |
| --- | --- |
| [01 SYSTEM IDEA](docs/context/01_SYSTEM_IDEA.md) | Problem, terminology, intended full architecture, calculations, people and failure cases |
| [02 CURRENT IMPLEMENTATION](docs/context/02_CURRENT_IMPLEMENTATION.md) | Actual stack, modules, APIs, simulation, status rules, dashboard, evidence, and remaining gaps |
| [03 MOBILE APP HANDOFF](docs/context/03_MOBILE_APP_HANDOFF.md) | Mobile design discussed in the chats, unknown implementation details, and integration questions |
| [04 REPORT AND PRESENTATION HANDOFF](docs/context/04_REPORT_AND_PRESENTATION_HANDOFF.md) | Attached report requirements, chapter-to-context mapping, source ledger, citation problems, and missing evidence |

## Current position in one table

| Area | Status supported by this repository |
| --- | --- |
| Raw pressure and Wi-Fi readings | Simulated; no physical sensors connected |
| Building | Virtual six-floor building, 20 m by 20 m per floor, 18 APs |
| Occupants | 40 named simulated roster entries; four deliberately never transmit |
| Floor and position calculation | Implemented: pressure conversion and nearest-neighbor RSSI fingerprint matching |
| Floor plans | Detailed illustrative 2-D rooms, labels, corridors, stairs, and door openings |
| Firefighter dashboard | Implemented with live local updates, prioritized alerts, names, floor selection, roster, and demo controls |
| Lost signals | Last computed location retained with age shown |
| Never-seen occupants | Shown in unknown-floor roster; no invented location |
| QR and hosted field view | Sharing and mirror code built; successful public deployment remains unverified |
| Occupant mobile app | Built separately according to the user; implementation details pending |
| Real Wi-Fi controller / badge feed | Not integrated; fixed roster and simulated AP state are used |
| Enrollment and organization accounts | Not implemented in this repository |
| 3-D building | Removed at the user's request; not part of the current product |

## Project identity from the supplied synopsis

- Formal title: **Fire Emergency Occupant Localization and Responder Orchestration System**.
- Dashboard name: **Ember / Fire Command**. This is the interface label, not a separate project.
- Institution: Ramdeobaba University, School of Computer Science and Engineering.
- Programme: IDEA Lab; Semester V; academic session 2026–2027.
- Synopsis date: 15 September 2026.
- Students: Nashit Hamza (A4-50), Mo Atif Azmi (A4-54), Aamir Hussain (A4-55), Shahwaiz Ahmed Khan (A4-60).
- Guide listed in the synopsis: Dr. Padma Adane (Dean CSE). Confirm final submission details with the team.

## How to describe the work accurately

Suggested factual wording: “We developed a simulation-based software implementation for fire-emergency occupant localization. A simulator supplies synthetic barometric-pressure and Wi-Fi RSSI readings because actual acquisition requires hardware setup and surveying outside our present expertise. The backend calculates floor and position estimates and presents live occupant status on a firefighter-oriented dashboard. Physical sensor integration and real-building validation remain future work.”

The chats express an ambition to make a complete, well-engineered software product using simulated inputs. That ambition does not establish production readiness. The present code is a local academic demonstration with working domain logic and explicit integration gaps.

Do not describe this as detecting unconsciousness, guaranteeing exact rooms, automatically finding every person, using a trained AI model, or proving rescue-time improvements. Do not describe FastAPI, React, Redis, PostgreSQL, or a real hardware testbed as the current implementation: they appear in earlier proposals, but are not the stack in this repository.

## Source priority and updates

Use current code to establish what this backend/dashboard actually does, the user's latest clarification to establish the simulation rationale, and the attached synopsis/chats to explain motivation and intended design. Treat generated chat prompts as design history, not proof of completion. The report template controls report organization, not project facts.

When the mobile context arrives, update file 03 first, reconcile payloads and units against file 02, then update this status table. Record the app version, evidence, and date. Keep planned, implemented, and tested behavior distinct.
