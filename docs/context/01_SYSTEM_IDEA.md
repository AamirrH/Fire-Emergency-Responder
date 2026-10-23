# System idea and intended working

This file explains the broader concept from the synopsis and Claude conversations. **Actual hardware acquisition is not part of the verified implementation: the current backend uses simulated data because the team lacks the hardware setup and surveying expertise needed to obtain real readings.** See [current implementation](02_CURRENT_IMPLEMENTATION.md) for what exists today.

## Problem and intended value

Fire alarms communicate that there may be a fire; they do not by themselves provide a named occupant's current floor and approximate room. Searching a multistory building without that context takes effort and can leave responders uncertain about people who never request help.

Our intended contribution is to combine location estimates and accountability information into one continuously updated view. It supports responder decisions; it does not replace physical search, human confirmation, fire detection equipment, or a certified emergency system. “Responder orchestration” currently means presenting information for human coordination, not automated team assignment or route planning.

## Terms in simple language

| Term | Meaning in this project |
| --- | --- |
| Barometer | Sensor measuring air pressure; pressure differences can be used to estimate relative height |
| Reference pressure | Pressure at a known building level against which a phone reading would be compared |
| AP | Wi-Fi access point, whose installation position and floor are recorded in the building map |
| RSSI | Received signal strength, normally expressed in dBm; a less negative value is stronger |
| Fingerprint | A group of signal readings associated with a known floor and coordinate |
| Fingerprint survey | Recording readings at planned locations before trying to locate an unknown device |
| Heartbeat | Automatic device telemetry sent periodically; not a human pulse or a user button press |
| Enrollment | Associating an authenticated person and organization with a device identifier |
| Badge-in/out roster | Records of people expected inside based on entrance/exit activity |
| Wi-Fi controller | Network management system that may expose AP/client connection records |
| Last-known location | Most recent calculated location, kept with its original timestamp when communication stops |
| SOS | Explicit request for help; separate from routine telemetry |

Use **x and y for horizontal coordinates, z/relative height for the vertical dimension, and floor as a discrete level**. Some early chats used “Y” to mean altitude and “X” to mean room; avoid repeating that inconsistent notation.

## Intended preparation before an incident

1. Digitize the building plans. Choose a common origin, scale in metres, and axis directions; encode room boundaries and corridors.
2. Record each AP's ID, physical location, and floor. If using phone scan data, map BSSID identifiers to these AP records.
3. Survey Wi-Fi signals on a planned grid, including room interiors, corridors, corners, and stairs. A 2–3 m grid was discussed; the software currently generates a 2 m synthetic grid instead.
4. Establish reference-pressure calibration and the actual elevations of building levels. A live reference sensor was proposed to compensate for shared weather changes; the current code uses a fixed constant.
5. Enroll people/devices and link organizational identity to attendance records. Obtain permission to use controller and roster feeds.
6. Keep the backend processing data and a command display available before an emergency starts.

The room map and fingerprint table are different datasets. The map says what region is a room; the fingerprints associate signal patterns with locations. Both must use the same coordinates.

## Intended full architecture

```text
Occupant app: raw pressure + Wi-Fi scan + device identity + SOS
                             |
                             v
Wi-Fi controller ------> Backend <------ Enrollment and attendance
connection history       |  |           person/device links and roster
                         |  +---------- Building map and fingerprints
                         v
             floor -> coordinate -> estimated room
             identity resolution and status processing
                         |
             +-----------+------------------+
             v                              v
 Ground-level command dashboard    Firefighter phone dashboard
                                      opened via a QR link
```

This is the target architecture, not a diagram of completed integrations. The backend can be cloud-hosted in a future deployment; current computation runs on the local Node server. A prepared cloud worker only mirrors already-computed state.

The occupant phone sends data **to the backend**. An AP provides network transport and also contributes measurable radio signals. It does not calculate a room or receive a special rescue message for processing. The separate controller feed describes network connections. Badge records describe people. An enrollment/identity bridge is required to join them; a badge tap does not reveal a phone MAC address.

## How location is estimated

### Floor from pressure

The conceptual method compares phone pressure with a known reference and converts the difference into relative height. The current simplified model is:

```text
height_metres = (reference_pressure_Pa - device_pressure_Pa) / 12
floor = round(height_metres / 4)
```

At reference pressure 101325 Pa, a reading of 101133 Pa means a 192 Pa difference, 16 m relative height, and floor 4 under the demo convention. A reading of 101181 Pa gives floor 3, not floor 4. Some chat examples use the latter as floor 4; those examples must not be copied with the current constants.

This code numbers levels 1–6 at 4–24 m above reference. A real ground-floor/lobby naming scheme needs explicit mapping. Real floors may have different heights; sensor offsets, temperature, HVAC, and changing pressure need calibration. The demo does not solve these issues.

### Position from fingerprint matching

After choosing a floor, compare the live RSSI values with that floor's survey points. For every candidate point, calculate the difference between the measured and reference RSSI for each shared AP, square those differences, add them, and take the square root. Select the point with the smallest result.

For example, live readings `[-58, -68, -60]` compared with candidate A `[-55, -70, -62]` produce `sqrt(9 + 4 + 4) = 4.12`; candidate B `[-65, -60, -70]` produces `sqrt(49 + 64 + 100) = 14.59`. Candidate A is the closer signal match. These are illustrative values, not measured experimental results.

This is nearest-neighbor matching in **signal space**, not triangulating the person's physical distance from the routers. Trilateration was discussed as an alternative; it is not the implemented solver. There is no neural network or training pipeline.

### Estimated room from coordinates

Take the matched coordinate and test whether it lies within a room's bounds. For example, a point `(14, 18)` is inside a room spanning x=10–20 and y=12–24. This is a generic explanation, not a claim about the current 20 m plan's specific rooms. Near boundaries, a location error can change the named room. Report “estimated room” or “near rooms,” not guaranteed exact occupancy.

### AP-only location is a weaker alternative

The chats considered dropping pressure/fingerprinting and using only an AP-to-floor lookup. This was an alternative, not the current implementation. It identifies a coverage area at best; signals cross floors and a phone's association is not guaranteed to be with the closest AP. The current simulation deliberately includes cross-floor attenuation instead of making all other-floor APs invisible.

## People, signals, and what can actually be inferred

| Situation | Intended interpretation | Current demonstration or limitation |
| --- | --- | --- |
| Occupant presses SOS | Explicit distress with latest location | Supported through a dashboard scenario button |
| Occupant cannot act but phone works | Automatic telemetry can continue | A fresh heartbeat alone cannot distinguish consciousness or distress |
| Device transmitted, then became silent | Preserve prior location; flag communication loss | Implemented as `heartbeat_lost` |
| Occupant never provided telemetry | Use roster and, if available, separate network history | Current four ghosts have no history and remain unlocated |
| Suspected fall | Possible sensor-fusion SOS | Proposed only; no fall classifier in this backend |
| Phone left behind | Device and person no longer coincide | Unresolved; tracking a device cannot prove its owner is beside it |
| Unregistered visitor | Identity may be unknown even if network data exists | No anonymous visitor discovery in current code |
| Person exits | Require suitable evidence/confirmation of safety | Current safe status is explicitly set by demo control |

The clearest three signal categories are **live telemetry, previously received telemetry now missing, and no telemetry ever received**. These are not medical categories. Unconsciousness does not automatically stop a phone service. Likewise, a dead connection does not prove injury or evacuation.

The planned roster/controller comparison operates per person/device, not merely by subtracting two totals. A person can have multiple devices; a visitor or a shared tablet complicates counts. If no identity link exists, network disappearance cannot reliably be attached to a named person. If no previous location exists, the correct output is unknown.

## Failure cases and future mitigations

| Failure or limitation | What remains possible / intended response |
| --- | --- |
| AP fails | Mark infrastructure coverage loss separately; match remaining APs if possible |
| Building mains fails | Proposed UPS and backup communication; current outage scenario models combined AP and handset communication loss |
| Wi-Fi and cellular unavailable | No new remote telemetry; retain last-known state and display age |
| No barometer | Proposed AP-based coarse floor fallback; current heartbeat contract requires pressure |
| App stopped, permissions denied, battery dead | Communication may stop; cannot infer the person's condition |
| Reference sensor or calibration wrong | Floor estimates can be biased; physical calibration remains future work |
| Renovation/AP relocation | Survey and AP map may become stale and require maintenance |
| Pressure changes/stairs/mezzanines | Need appropriate level calibration and stability logic; not implemented |
| MAC randomization | Identity-to-network correlation needs a dependable enrollment strategy |
| Stale badge roster | Expected occupancy can be wrong; reconcile exits and manual accounting |
| Network overload/backend outage | Current UI flags stale data; production redundancy and load validation remain open |
| Phone carried at different heights/orientations | Can change measured pressure/RSSI; no validated compensation in the demo |

The chats discuss backup power, cellular fallback, consent, retention, restricted responder access, and off-site computation as design considerations. They are not evidence of installed equipment, measured battery performance, or tested failover. Platform/API and legal claims from chats need independent verification before being used as factual report claims.

## Intended operational scenario

In the broader design, a registered employee enters, is recorded on the roster, and their phone transmits automatic telemetry. The backend continuously resolves identity and estimates location. During an incident, an SOS becomes visible on the command screen. If communication subsequently fails, the prior position and time remain visible. Separately, a roster member missing from network and phone feeds is flagged for checking; an AP history would provide only a coarse last-known area if available. Firefighters call the person's name and search using the displayed estimate. A verified evacuation is recorded as safe.

The QR view is a responder reading interface. It is distinct from the occupant app that generates signals. No automatic dispatch, guaranteed rescue, or route safety assessment is implied by this scenario.
