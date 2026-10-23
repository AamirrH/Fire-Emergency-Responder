# Run and test the backend with the mobile app

Checked against the repository on 23 October 2026. These instructions are for Windows PowerShell and a physical Android phone. They start the existing code without fixing the issues identified in review.

**Use simulated sensor mode for this test.** The phone generates synthetic pressure and Wi-Fi RSSI; the backend calculates the floor and position. We use simulated data because obtaining real readings requires hardware setup, calibration and surveying outside the team's current experience.

## 1. What needs to run

| Component | Where | Purpose |
| --- | --- | --- |
| Node backend | PC, terminal 1, port 3000 | Receives phone heartbeats, calculates locations, serves dashboard |
| Command dashboard | PC browser | Shows the computed incident state |
| Expo development server | PC, terminal 2, normally port 8081 | Loads the mobile source into Expo Go; unnecessary with a standalone APK |
| Occupant mobile app | Android phone | Claims an occupant and sends simulated readings to port 3000 |

The Expo terminal QR opens the **occupant app**. The command dashboard's “Open on phone” QR opens the separate **responder field dashboard** and is not used in this local test. Public hosting is not required.

## 2. Check the PC and phone

1. Keep the PC connected to your router. Ethernet on the PC and Wi-Fi on the phone are fine if both are on the same local network.
2. Connect the phone to that router's ordinary Wi-Fi, not an isolated guest network.
3. Open PowerShell and check:

```powershell
node --version
npm --version
ipconfig
```

Node `v22.14.0` was available when this guide was prepared. Use a Node version compatible with the mobile project's Expo dependencies; the root backend alone declares Node 20 or newer. The mobile test command uses Node's TypeScript stripping support.

At the time of inspection, this PC's active Ethernet IPv4 address was **192.168.0.143**, with gateway **192.168.0.1**. Its Wi-Fi adapter was disconnected. The separate `192.168.56.1` adapter had no default gateway; do not use that address for the ordinary phone-on-router test.

Addresses can change. If `ipconfig` now shows a different address on the adapter connected to your router, substitute it everywhere below.

## 3. Terminal 1: start the backend

If an older backend is already running on port 3000, stop it with Ctrl+C in its terminal first. The token and host settings below only take effect when starting the server.

```powershell
cd "D:\Indoor Fire Localization"
npm install
$env:HOST = "0.0.0.0"
$env:PORT = "3000"
$env:DEVICE_TOKEN = "demo123"
npm start
```

Run these lines in the same terminal. Skip `npm install` on subsequent runs unless dependencies changed. `demo123` is a local test token: enter the same value on the phone. It is not a production credential.

Expected startup message:

```text
Fire locator demo: http://0.0.0.0:3000
```

Keep this terminal open. `0.0.0.0` means the server listens on the PC's network interfaces; it is not the address to enter on the phone.

Open the PC dashboard at:

```text
http://localhost:3000
```

In a spare terminal, this read-only check should return a building with six floors and 18 APs:

```powershell
Invoke-RestMethod "http://127.0.0.1:3000/api/building"
```

## 4. Verify phone-to-PC access before opening the app

On the phone, open its browser and visit:

```text
http://192.168.0.143:3000/api/building
```

You should see JSON containing building configuration. If this does not load, solve the address/network/firewall problem first; Expo cannot fix backend reachability.

If Windows asks whether Node.js may communicate on the network, allow the trusted private network being used for this test. If necessary, use Windows Defender Firewall settings to allow Node on that private network. Do not disable the firewall wholesale. Guest Wi-Fi/client isolation or a VPN can also prevent access between the devices.

## 5. Choose how to open the mobile app

### Option A: Expo Go, using the checked-out source

This is the preferred path for development because it loads the current source and can reload code changes. Install Expo Go on the Android phone. The project declares **Expo SDK 57**; the Expo Go version must support that SDK. See the official [version mismatch guidance](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/) if necessary; do not upgrade the project just to dismiss a mismatch.

Open a second PowerShell terminal:

```powershell
cd "D:\Indoor Fire Localization\mobile"
npm install
npm start -- --go --lan
```

The project's start script runs `expo start -c`; the extra flags request Expo Go over LAN. Keep terminal 2 open. Scan its QR code using Expo Go on the phone. This is the development flow described by [Expo's startup documentation](https://docs.expo.dev/get-started/start-developing/) and [CLI reference](https://docs.expo.dev/more/expo-cli/).

The development server usually uses port 8081. The backend still uses **3000**. Do not enter the Metro/Expo URL into the app's Server URL field.

If the QR points to the wrong PC adapter, stop terminal 2 with Ctrl+C and start again with the correct current address:

```powershell
$env:REACT_NATIVE_PACKAGER_HOSTNAME = "192.168.0.143"
npm start -- --go --lan
```

If an install/build fails, retain the exact error. Avoid `npm audit fix --force` or arbitrary dependency upgrades during the first integration test. Mobile dependencies were not installed locally when this guide was prepared, so the first installation may take a while. Android Studio is not needed for this Expo Go route on a physical phone.

### Option B: use the existing Android APK

If your friend already installed the app on your phone, you can open it directly. Otherwise, with the backend running, open this address in the phone browser:

```text
http://192.168.0.143:3000/download/apk
```

The repository includes `public/ember-responder.apk`, which this route serves. Install it on Android, allowing installation from that browser if prompted for this trusted project APK. A standalone build does not require terminal 2 or Expo Go.

The bundled APK's exact correspondence to the current source commit has not been verified. If its UI or behavior differs from these instructions, record its version and use the source route or a rebuilt APK. Updating source files does not update an installed standalone APK.

## 6. Connect and claim an occupant

In the app's connection screen, enter:

```text
Server URL:   http://192.168.0.143:3000
Device Token: demo123
```

Replace the prefilled `10.212.53.42` address—it was hardcoded in the contributed app and is not this PC's inspected address. Do not use the app's quick-fill button for that old address.

Tap **Test Connection**, then **Continue**. Expect six floors and 18 APs. This test only fetches public building data; it does not validate the device token. Token validation happens when claiming/sending to the device API.

Select **D005 — Arjun Patel** on the enrollment screen. This claims D005 so the backend simulator stops supplying that occupant's readings. The app should start sending its own heartbeats approximately every two seconds. Other occupants remain controlled by the server simulator.

If the app automatically opens an old saved session, go to Settings and **Release Handset Back to Simulator**, then select D005 again. If it has the wrong server configured, change the connection details and enroll again. Do this after any backend restart or dashboard reset, too: the current app does not reliably restore the server-side claim automatically.

Keep **Real Hardware Barometer (Experimental)** switched off. Keep the app open and screen on; the current implementation does not provide a native background service.

## 7. Prove that heartbeats are arriving

On the phone, check that **Total sent** increases and **Last sent** repeatedly returns to a small age. On the PC dashboard:

1. Select Floor 1.
2. Enable **Show everyone**, since the default view prioritizes alerts.
3. Find D005 / Arjun Patel on the map or in the occupant roster.
4. Check that its last-heartbeat time keeps refreshing.

For an independent backend check, open a third PowerShell terminal:

```powershell
$deviceHeaders = @{ "x-device-token" = "demo123" }
Invoke-RestMethod "http://127.0.0.1:3000/api/device/D005/status" -Headers $deviceHeaders |
    Select-Object device_id, name, floor, x, y, status, last_heartbeat
```

Run it again a few seconds later. The timestamp should advance. A timestamp by itself is not enough to prove the phone owns the device, because the server simulator also sends heartbeats. The movement and silence checks below provide stronger evidence.

Known display issue: the phone's “My Computed Status” may show **Pending** coordinates, an unknown room, or **N/A** match distance even while the server has valid results. Its Socket.IO field mapping differs from the server's schema. Use the PC dashboard and the REST status check above as the authority for this first test.

## 8. Short end-to-end test

| Action | Expected result |
| --- | --- |
| Phone: Move Demo -> select F4 | Within a few seconds, backend reports floor 4; pressure is near 101133 Pa |
| Phone: tap a different map position | Dashboard marker changes toward the matched grid location; estimates need not exactly equal the chosen coordinates |
| Phone: press SOS and wait five seconds | D005 becomes `active_sos`, Floor 4 turns red, dashboard SOS count increases |
| Phone: cancel sent SOS within 15 seconds | Server clears SOS; occupant returns to its applicable normal status |
| Phone: Settings -> Simulate Phone Dying | Total sent stops; after more than eight seconds without a heartbeat, server shows `heartbeat_lost` and retains the last position |
| Phone: Resume Heartbeats | Timestamp advances and status returns to active if no other condition takes precedence |

If SOS remains active, it has priority for 30 seconds from the SOS event. Cancel it or wait for that window to expire before judging the eight-second silence test. Allow an extra update cycle for the dashboard to display the transition.

Avoid **Reset demo** during the test: it clears device claims, allowing the server simulator to resume D005 and mask phone silence. If you reset, release/reselect D005 before continuing. Do not mark D005 safe until the end; safe status persists until reset and overrides other statuses.

Success means the app's chosen floor changes the backend result, its SOS changes the dashboard, and stopping its heartbeats produces a lost-signal state. This demonstrates actual app-to-backend communication using **simulated sensor inputs**, not real indoor location measurement.

## 9. Troubleshooting

| Symptom | Check |
| --- | --- |
| npm cannot find package.json | Backend terminal must be in the project root; Expo terminal must be in `mobile` |
| `EADDRINUSE` on port 3000 | Stop the previous backend in its own terminal, then restart with the required host/token settings |
| Dashboard works on PC, phone cannot fetch building JSON | Confirm `HOST=0.0.0.0`, current router-facing IP, common network, firewall and client isolation |
| Expo app will not load but building JSON does | Investigate Expo/8081 reachability, QR adapter address and SDK compatibility separately |
| Test Connection succeeds but claim returns 401 | Token differs or backend was started without DEVICE_TOKEN; restart with matching token |
| Values jump between unrelated positions | Release/reclaim after restart/reset; only one phone should control D005 |
| Phone coordinates Pending but server status valid | Known live-feed field mapping issue; not necessarily a heartbeat failure |
| Silence test stays active | Check claim ownership, active SOS window, safe status and whether another phone is sending as D005 |
| App closes or throws an error | Capture the exact screen/terminal error; passing calculation tests does not validate app rendering |
| App stops updating when backgrounded | Keep it foregrounded for this test; background operation is not implemented |

The current connection screen explicitly rejects `10.0.2.2`, although that address is normally used by an Android emulator to access its host. Therefore this guide uses a physical phone; the emulator path needs that code issue addressed before relying on the existing README instructions. Expo web is also not the recommended first path: CORS is enabled for `/api/device` but not all building/live endpoints used by the browser app.

The restored 3-D dashboard panel is unrelated to mobile heartbeat transport. The phone's “Help is on the way” text confirms neither dispatch nor responder acknowledgement; this backend only records SOS.

## 10. Stop and restart cleanly

1. On the phone, release the handset back to the simulator.
2. Close the app.
3. Press Ctrl+C in the Expo terminal, if used.
4. Press Ctrl+C in the backend terminal.

Next time, repeat the host/token settings in terminal 1 and the start commands. Install dependencies again only when needed. Claims and live incident state are in memory; they do not survive backend restarts.

Optional automated checks:

```powershell
cd "D:\Indoor Fire Localization"
npm test
```

```powershell
cd "D:\Indoor Fire Localization\mobile"
npm test
```

The preceding code review ran 13 backend tests and six mobile calculation tests successfully. Those tests do not substitute for the physical-phone walkthrough above.
