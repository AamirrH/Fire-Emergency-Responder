# Ember Responder SOS (Mobile App)

An occupant-side React Native (Expo, TypeScript) handset companion app for **Ember**, the indoor fire-emergency occupant localization prototype.

> ⚠ **Classroom Demo Prototype**: This app is designed for academic evaluation and demonstration. It is NOT a certified life-safety emergency application.

---

## Architecture & Data Boundary

- **Strict Raw-Sensor Ingress**: Heartbeat packets sent to `POST /api/device/heartbeat` contain **strictly** three keys:
  ```json
  {
    "device_id": "D005",
    "raw_pressure": 101277,
    "raw_rssi": {
      "AP-1": -42.5,
      "AP-2": -58.1,
      "AP-3": -66.0
    }
  }
  ```
  The handset never sends floor, x, y, name, or status. The backend inverts the barometric pressure lapse and solves Euclidean nearest-neighbor fingerprint matching against `fingerprint_map.json`.
- **Claim & Release Mechanism**: Selecting a device calls `POST /api/device/claim`, which halts `Simulator.tick()` from generating automated heartbeats for that device ID. Releasing it returns the device to the simulator.
- **Live Status Feed**: Connects to the Socket.IO `/live` namespace to receive server snapshots and revision-gap checked state diffs.
- **Accidental Tap SOS Protection & Cancel Grace**: Pressing the SOS button initiates an immediate 5-second countdown ("Cancel (accidental tap)") before dispatching `POST /api/device/sos`. A 15-second grace window allows cancelling false alarms via `POST /api/device/sos-cancel`.

---

## Installation & Setup

### 1. Start the Backend Server

In the root project directory:

```bash
# Run server binding to all network interfaces with device token
HOST=0.0.0.0 DEVICE_TOKEN=demo123 PORT=3000 npm start
```

*(On Windows PowerShell, set the environment variables prior to running `npm start`:)*
```powershell
$env:HOST="0.0.0.0"
$env:DEVICE_TOKEN="demo123"
npm start
```

Confirm the server starts and displays:
`Fire locator demo: http://0.0.0.0:3000`
Open the web dashboard at `http://localhost:3000` in your computer's browser.

### 2. Start the Mobile App

Navigate into the `mobile/` directory:

```bash
cd mobile
npm install
npm start
```

Press `a` to open on Android Emulator, or scan the QR code with **Expo Go** on a physical phone connected to the same Wi-Fi network.

#### Android Emulator Note
If running inside the Android Emulator, use `http://10.0.2.2:3000` as the Server URL (Android routes `10.0.2.2` to the host computer's `127.0.0.1`).

---

## Manual Test Script (Walkthrough)

Follow these steps to demonstrate full hardware-in-the-loop localization:

1. **Connection**:
   - Open the app. In the Connect screen, enter:
     - **Server URL**: `http://<YOUR_PC_LAN_IP>:3000` (or `http://10.0.2.2:3000` for emulator)
     - **Device Token**: `demo123`
   - Tap **Test Connection**. Verify the app reports finding 6 floors and 18 access points. Tap **Continue**.

2. **Device Enrollment**:
   - The Enroll screen lists roster devices `D001` through `D036` (ghost devices `D037–D040` are strictly excluded).
   - Tap on **D005 - Arjun Patel**.
   - Notice the short linking step (`Logging in... linking to device D005`).
   - Look at the web command dashboard: device `D005` is now receiving heartbeats from your phone!

3. **Live Status Verification**:
   - On the Home screen, observe:
     - Header badge shows **WiFi** and **Fire Safety System: Active**.
     - Live sensor card displays current synthesized `raw_pressure` and top 3 AP RSSI values.
     - "My Computed Status" card reflects backend computation from Socket.IO: Floor 1, coordinates, room name, and signal match distance in dB.

4. **SOS Alert & Cancel Grace**:
   - Tap the large circular red **SOS** button.
   - Haptic feedback fires, and a 5-second "Cancel (accidental tap)" countdown begins.
   - Let the countdown expire: `POST /api/device/sos` is dispatched.
   - On the web dashboard, Floor 1 instantly highlights in red and the Active SOS metric increments to 1.
   - On the phone, tap **Cancel SOS (False Alarm)** within 15 seconds. Confirm the alert clears and returns to Active.

5. **Virtual Motion & Floor Descent**:
   - Navigate to the **Move Demo** tab.
   - Select **F4** on the floor picker.
   - Notice the phone's synthesized pressure drops from ~101277 Pa to ~101133 Pa.
   - On the web dashboard, watch marker `D005` update to Floor 4.
   - Tap **🏃 Walk to Stair A and descend**: watch the occupant walk to Stair A and step down one floor every 3 seconds, demonstrating emergency stair evacuation.

6. **Simulate Handset Destruction ("Phone Dying")**:
   - Go to the **Settings** tab.
   - Tap **Simulate Phone Dying (Stop Heartbeats)**.
   - The phone immediately halts outgoing heartbeats.
   - Watch the web dashboard: after 8 seconds of silence (`HEARTBEAT_TIMEOUT_SECONDS`), `D005` transitions to **Signal Lost (heartbeat_lost)** with its last known coordinates frozen on the floor map.
   - Tap **Resume Heartbeats**: the handset resumes transmission and restores to **Active**.

7. **Release Device**:
   - In Settings, tap **Release Handset Back to Simulator**.
   - The handset unclaims the identity and returns to the Enroll screen.
   - The server simulator resumes generating simulated occupant movements for `D005`.

---

## Unit Testing

Run the pure physics and state validation unit tests:

```bash
cd mobile
npm test
```

Tests cover:
- Pressure synthesis lapse rate and noise bounds
- RSSI log-distance decay, AP coverage, and floor attenuation
- Strict 3-key heartbeat payload shape verification
- Architectural room lookup from coordinates and floor plans
- SOS cancel window expiration logic
- Real barometer calibration and offset mapping

---

## Limitations & Architectural Notes

- **Background Execution**: In this Expo implementation, `expo-keep-awake` keeps the screen on while foregrounded. True background execution in production responder handsets requires an Android Foreground Service with continuous wake lock, which requires a bare React Native development build. iOS restricts background socket traffic and Wi-Fi RSSI scanning.
- **Hardware RSSI**: The app runs in simulated sensor mode by default because modern mobile operating systems restrict direct access to 802.11 beacon RSSI measurements. Real barometer mode reads ambient pressure via `expo-sensors` Barometer and calibrates against the building model.
