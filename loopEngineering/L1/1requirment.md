# Requirement and Structure

> **Goal:** Build a clean, responsive IoT demo dashboard (Login + Dashboard) with HTML, CSS & vanilla JavaScript, integrating ThingsBoard REST API & WebSocket for real-time telemetry.
>
> **Related files:** standards → `Skill.md` · process → `L1/2builder.md` · API paths, payloads & sensor ranges → `L1/3api-contract.md` · developer answers → `CLARIFICATIONS.md`

---

## HTML

### Login Page

- Input fields for **username** and **password**
- Button: `Login to Dashboard`

### Dashboard Page

- Single `Logout` button → navigates back to Login

#### Lab 1: Raw Telemetry Streaming — "Raw Signal Diagnostics" Dashboard

> **Concept:** A diagnostics-style dashboard focusing on the speed of numerical updates and physical waveforms.

**MQTT Telemetry Payload (from device):**

```json
{
  "mpu_temp": 23.97647,
  "acc_x": 0, "acc_y": 0, "acc_z": 1,
  "gyro_x": 0, "gyro_y": 0, "gyro_z": 0,
  "angle_x": 0, "angle_y": 0, "angle_z": 0
}
```

**Serial monitor format** (device side, for reference only — the dashboard never reads serial output):
```
0:T=24,ACC=0.00,0.00,1.00,GYRO=0,0,0,ACC ANGLE=0,0,ANGLE=0,0,0
```

---

##### 1. Multi-axis Real-time Line Chart (Live Signal Waveform)

- Displays **overlaid line graphs** for 3-axis acceleration ($X$, $Y$, $Z$)
- Moves in **real-time** with a **rolling window** of the last **8 seconds** — draw every point received in that window and drop older points
- The device currently publishes **1 message per second** (~8 points in the window). The chart must also work at faster rates, up to **20 Hz** (~160 points)
- Visualizes signal noise/fluctuations when the sensor moves
- Each axis uses a **distinct HSL-tuned color**: X = `hsl(0, 75%, 60%)`, Y = `hsl(145, 65%, 50%)`, Z = `hsl(215, 80%, 60%)`
- Axis labels with units in **g** (the device sends acceleration in g — no unit conversion)
- Render using **HTML5 `<canvas>`** — no external charting libraries

##### 2. Raw Value Numeric Tiles (Live Numeric Display Boxes)

- A grid of tiles displaying **current numerical values** (built with CSS Grid — see `Skill.md` § Layout & Responsiveness)
- Separated by sensor type and axis:

| Sensor        | X     | Y     | Z     | Unit            |
| ------------- | ----- | ----- | ----- | --------------- |
| Acceleration  | acc_x | acc_y | acc_z | g               |
| Gyroscope     | gyro_x| gyro_y| gyro_z| °/s             |
| Angle         | angle_x| angle_y| angle_z| $\text{°}$   |
| Temperature   | —     | —     | mpu_temp | $\text{°C}$  |

- Values update in **real-time** as telemetry arrives
- Units are exactly what the device sends — display raw values, no unit conversion

##### 3. Sensor Tilt Indicator (2D Tilt Gauge)

- A small **square box** containing a **dot**
- The dot moves along the **X and Y axes** reflecting sensor tilt
- Maps `acc_x` and `acc_y` values to dot position using linear mapping: input range `[-1g, +1g]` → output range `[0%, 100%]` of box dimensions, clamped at boundaries
- Allows learners to **visualize the sensor's tilt** interactively
- Includes crosshair/grid lines for center reference

##### 4. LED On/Off Control Switch

- A toggle switch (On/Off) to **send RPC commands** to the device
- Toggles an **LED** on the connected hardware
- Sends command via ThingsBoard **REST API (RPC)** — method and payload in `L1/3api-contract.md` § 7
- Visual feedback showing current LED state:
  - **On dashboard load** → show the device's `led_state` client attribute (`L1/3api-contract.md` § 6). If it is missing or cannot be read → show OFF
  - **While the dashboard is open** → subscribe to `led_state` over the WebSocket (`L1/3api-contract.md` § 8) and update the switch whenever the device reports a change (e.g. device reboot, another user). Ignore updates while a command is waiting for the device reply
  - **After a successful command** → show the `led_state` returned by the device
  - **If the command fails** (e.g. device offline) → switch back to the previous state and show an error message

---

## Out of Scope (L1)

Do not build these — ask the developer first if one seems necessary:

- Device picker or multi-device support (use the first device of the customer)
- Historical telemetry charts or date-range queries
- User registration, password reset, or account settings
- Device configuration, alarms, or notifications
- Any custom backend server

---

## Output Location

Write all web app files in `DemoApp/` (relative to the project root): `login.html`, `dashboard.html`, `css/`, `js/`. Open `DemoApp/login.html` to start the app.

---

## CSS

- Controlled by **CSS variables only**
- Style: dark-theme, mobile-first, responsive (breakpoints: 320px, 768px, 1280px)
- Split CSS file per HTML page (`login.css`, `dashboard.css`)
- Each page CSS file uses `@import common.css`
- `common.css` contains global CSS variables and base styles

---

## JavaScript

> Module-based — uses only native browser `fetch` API for all HTTP requests

| Purpose | Logical name | Real path (from `L1/3api-contract.md`) | Auth |
| ------- | ------------ | -------------------------------------- | ---- |
| Login | `/login` | `POST /api/auth/login` | JSON body `{ username, password }` |
| Refresh token | `/oauth2/token` | `POST /api/auth/token` | JSON body `{ refreshToken }` |
| Get Customer ID | `/customer/credentials` | `GET /api/auth/user` | `X-Authorization: Bearer {token}` |
| Get Device ID | — | `GET /api/customer/{customerId}/devices` | `X-Authorization: Bearer {token}` |
| Get Device Access Token | `/device/credentials` | `GET /api/device/{deviceId}/credentials` | `X-Authorization: Bearer {token}` |
| LED command | RPC | `POST /api/rpc/...` (see `L1/3api-contract.md` § 7) | `X-Authorization: Bearer {token}` |
| Real-time telemetry | WebSocket | `wss://.../api/ws/plugins/telemetry?token={token}` | JWT `token` in the URL |

> **Full API contract** (base URL, request/response schemas, WS subscription format): see `L1/3api-contract.md`. If this table and the contract disagree, the contract wins.

---

## Flow

### Login Page

1. User submits credentials (a **Customer User** account)
2. Use REST API to login → obtain `token` & `refreshToken`
3. Use REST API to get the **Customer ID** of the logged-in user
4. Use REST API to get the **Device ID** from the Customer ID
5. Use REST API to get the device **Access Token** from the Device ID
6. **On success** (all of steps 2–5) → navigate to Dashboard
7. **On failure** (any of steps 2–5) → stay on Login and display a user-friendly error message

### Dashboard Page

1. If there is no session (not logged in) → redirect to Login
2. Use **WebSocket** to subscribe to telemetry data and the `led_state` attribute from ThingsBoard (see `L1/3api-contract.md` § 8 for subscription format) and update all 4 widgets
3. Use **REST API** to post device RPC commands to ThingsBoard
4. On logout → clear the session, close the WebSocket, and navigate back to Login