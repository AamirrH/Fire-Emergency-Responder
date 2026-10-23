# Context for the report and presentation author

This is preparation material, not a completed report, slide deck, literature review, or submission. The attached report instructions have been recorded as requirements for the eventual author. They do not change the present request to create Markdown context only.

## The most important scope statement

**We are using simulated data because actual sensor acquisition requires hardware setup, calibration, and surveying that the team does not currently know how to do.** Explain this in the introduction/scope, methodology, experimental setup, and limitations. The simulator provides synthetic raw measurements; the backend calculates estimated locations and statuses from them. Both the live inputs and reference fingerprints are synthetic.

Do not say that the team collected a real building dataset, connected physical Wi-Fi controllers, installed reference barometers, or validated the system during a real fire. The separately built mobile app needs its own evidence before making any claim about real sensor readings or successful integration.

## Attached source ledger

| ID | Supplied source | Use and limitations |
| --- | --- | --- |
| S1 | `RBU-A4-2-Fire-Emergency-Responder-Project-Synopsis.pdf` | Formal title, team, institution, motivation, proposed objectives, scope and references. A proposal, not proof of implementation. Nine PDF pages; printed footer numbers run through page 10, so identify sections rather than trusting displayed footer counts. |
| S2 | `CLAUDE_CHAT_1.txt` | Original design exploration: pressure, Wi-Fi fingerprints, coordinate maps, heartbeat operation, people/failures, controller and roster inputs, identity, responder display and QR. Contains alternative ideas and explanations later corrected. |
| S3 | `CLAUDE_CHAT_CONTINUE.txt` | Merge flow, evacuation discussion, cloud/fallback ideas, synopsis drafting, simulation-only build prompts, proposed fingerprint viewer and mobile simulator. Prompts do not establish that features were delivered. |
| S4 | `CLAUDE_CHAT_CONTINUE_2.txt` | Corrects the unconsciousness/heartbeat confusion and identity bridging; explores AP-only alternative, software-product ambition with synthetic inputs, and native Android app design. Describes proposed APIs that differ from current code. |
| S5 | `Instructions for project report.docx` | Explicit university structure and formatting requirements. |
| S6 | `Idea Lab Project sample report.docx` | Structural example about a different project, Smart Campus Energy Monitoring. Includes placeholder names, unrelated text, fabricated example numbers and reference placeholders. None are evidence for our project. |
| S7 | Current repository, inspected 22 October 2026 | Primary evidence for actual backend/dashboard behavior: see source paths in file 02. |
| S8 | This project conversation and latest user clarification | Firefighter-first UI intent, names, QR portability, removal of 3-D, larger 2-D display, file organization, separate mobile ownership, and explicit reason for simulation. |

The original supplied documents are not copied into this pack. Keep them available separately if the author needs the source wording. No Notion page contents, app repository, or external paper full texts were retrieved in preparing this pack. Claims that a chat says it researched a paper are not independently verified citations.

## Required report structure from S5

1. Cover page.
2. Student declaration.
3. Acknowledgement.
4. Abstract.
5. Table of contents.
6. List of figures.
7. List of tables.
8. List of abbreviations, if applicable.
9. Chapter 1: Introduction.
10. Chapter 2: Literature Review and Research Gap.
11. Chapter 3: Proposed System and Methodology.
12. Chapter 4: System Design and Implementation.
13. Chapter 5: Results and Discussion.
14. Chapter 6: Conclusion and Future Scope.
15. References/Bibliography.
16. Appendices, if applicable.
17. Annexure A: Publications and Intellectual Property.
18. Student Contribution Statement.

The cover requires university name/logo, school, project title, student names/roll numbers, guide and academic year. S6 additionally demonstrates a certificate and approval sheet, and labels contributions Annexure B and project outputs Annexure C. Confirm these additions with the guide instead of silently assuming one source overrides the other. Confirm the precise B.Tech specialization; the sample offers multiple alternatives.

## Formatting requirements extracted from S5

| Item | Stated requirement |
| --- | --- |
| Paper | A4, white |
| Body | Times New Roman, 12 pt, justified |
| Chapter heading | 16 pt, bold, uppercase |
| Section heading | 14 pt, bold |
| Subsection heading | 12 pt, bold |
| Line spacing | 1.5 |
| Paragraph spacing | 6 pt after |
| Margins | Left 1.5 inches; right, top and bottom 1 inch |
| Page numbering | Bottom centre; no page number on first page |
| Printing | Single-sided unless otherwise instructed |
| Length | 3,000–6,000 words |
| Authoring format | LaTeX (instruction text: “Should in Latex”) |
| Chapters | Chapter separator |
| Electronic copy | Submission on DT 602, as stated; verify the submission procedure with the department |

The sample mentions **20–25 relevant references in IEEE style**. That statement occurs in S6; S5's extracted instructions do not independently state the number. Treat it as a sample-stated expectation to confirm. The sample's Word automatic-TOC instruction conflicts with S5's LaTeX requirement; use the explicit report instructions as the working baseline and resolve ambiguity with the guide. Nothing here requires creating LaTeX files in this context task.

## Where the report author should find content

| Report part | Context to use | Evidence still needed |
| --- | --- | --- |
| Introduction | Root CONTEXT; file 01 problem, users and objectives | Approved final title and precise programme |
| Literature review | S1 candidate references and corrections below | Original papers, verified metadata, defensible comparison and citations |
| Proposed methodology | File 01; clearly labelled intended architecture | Decisions about future controller, roster and sensor integration |
| Implementation | File 02 module map, processing, APIs and UI | Current screenshots, environment versions, mobile owner's context |
| Results | Tests and demo observations; distinguish synthetic from real | Recorded runs, actual metrics if reporting numbers, integrated app evidence |
| Conclusion/future scope | Implemented vs pending table; files 01 and 03 | Team-approved completion assessment |
| Contributions | Confirm directly with each student | Specific verifiable responsibilities; do not copy sample assignments |
| Publications/IP | Only actual project evidence | Do not claim submissions, acceptance or patents from sample rows |

The report should have separate diagrams for the **intended complete system** and the **implemented simulation pipeline**. Otherwise readers may mistake controller/attendance/cloud components in a design diagram for completed integrations.

## Evidence available now

On 22 October 2026, `npm test` passed 11 tests but the HTTP/Socket.IO test timed out waiting for a snapshot under restricted networking. Running `node --test test/server.test.js` with local-network access outside that restriction passed. Together these runs exercised all 12 existing tests successfully. No application logic was changed for this context task.

These tests support mathematical consistency, schema handling, status transitions, live local delivery, QR target encoding and worker behavior under test conditions. They do not establish deployed public connectivity or physical accuracy. The hosted worker tests use a test environment rather than proving a production bucket/site is available.

The synthetic estimation test uses 120 seeded locations and asserts mean error below 2 m. Do not turn that threshold into an exact measured error value. If a table needs mean, median, maximum, percentiles, room classification accuracy, or latency, first run a documented measurement procedure and retain its output. State the same-model survey/simulation limitation prominently.

Useful screenshot evidence to collect: initial counts and unknown roster; SOS with a named person; last-known position after silence; AP outage warning; selected floor with labelled rooms; explicit safe confirmation; stale connection state. Images in `assets/` may predate current UI changes. A QR screenshot alone is not evidence of a working hosted link.

For later evaluation, distinguish floor correctness, coordinate error in metres, room classification correctness, status-transition timing, and delivery latency. These are different quantities. Specify random seed, number of points, noise, AP availability, sample duration and version for each experiment. Do not reuse S6's sample accuracy 91.2%, F1 0.90, or processing time 29 ms.

## Literature problems to resolve before final writing

S1 includes eight candidate references, but its narrative/table does not consistently describe the same papers as the bibliography:

| Reference | Candidate in the bibliography | Internal discrepancy or verification need |
| --- | --- | --- |
| [1] Bahl and Padmanabhan | RADAR, 2000 | Candidate for RSSI positioning; verify the actual methods and claims in the paper |
| [2] Kim, Kim and Han | Floor detection using a barometer sensor in a smartphone, 2017 | Table says 2018; confirm metadata and findings |
| [3] Cola and colleagues | Fall detection using a head-worn barometer, 2017 | Table instead describes 2021 first-responder inertial tracking; these are not interchangeable |
| [4] Khan and colleagues | IoT-based smart fire detection, 2023 | Table instead describes a 2022 BLE/Wi-Fi hybrid; verify original source |
| [5] Neto and colleagues | Context-based multi-agent fire guidance, Electronics, 2022 | Table instead describes 2024 passive Wi-Fi logging; replace with a source-supported description |
| [6] Xia and colleagues | Multiple barometers for smartphone floor location, Sensors, 2015 | Verify citation and relevant result before using |
| [7] Fetzer and colleagues | Barometer floor assignation within statistical indoor localization | Synopsis says 2017; S4 claims a correction to 2023. Resolve using the original publication; neither year is endorsed here |
| [8] Yu and colleagues | Floor positioning with a smartphone barometer, 2019 | Verify metadata and any quoted accuracy; external study results are not our system's results |

Do not reproduce the synopsis's absolute claim that no comprehensive solution exists without a literature search. A defensible project motivation is the value of combining location, accountability and responder presentation in this demonstration. Novelty and comparative performance require separate evidence.

## Corrections to keep in the report and presentation

- Unconsciousness does not itself stop automatic phone telemetry. No consciousness classifier exists here.
- A missing connection is not proof of injury, death, or evacuation.
- A phone location is not certain person location if the phone was left behind.
- A badge system identifies people; a controller identifies network clients. Enrollment links them.
- RSSI may include APs from other floors. Filter the candidate location grid by the detected floor; do not claim other-floor radio signals cannot exist.
- Pressure increases on descent in the simplified model; avoid the chat's occasional opposite wording.
- A live reference sensor and fixed reference constant are different. Only the latter exists in this demo.
- Heartbeat rates of 30–60 / 5–10 seconds are proposals; the built-in simulator uses 2 seconds.
- Database persistence, controller integration, real surveys, fall detection, automatic evacuation, mobile enrollment and emergency alarm relay are not completed backend features.
- Successful 3-D visualization is not a deliverable; the feature was removed.
- The public QR destination remains unverified as a live deployment.

## Suggested presentation sequence, not finished slides

Explain the rescue-information problem; identify occupants and responders; state the simulation choice and reason early; distinguish intended architecture from current implementation; explain pressure -> floor -> fingerprint -> estimated room; demonstrate named SOS and missing-signal cases; show test evidence with its limits; then discuss the friend's app only with its supplied evidence. Finish with integration and real-hardware work still needed.

The core sentence to be able to defend is: **“The input data is simulated; the software that estimates locations and updates the dashboard is implemented and tested under those simulated conditions.”**
