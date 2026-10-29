# ThingsBoard API Contract

> **Version:** 4.1 · **Last Updated:** 2026-10-17
> **Source:** Bruno test results `cloud.json` (2026-10-13, `thingsboard.cloud`, `CUSTOMER_USER`, device `ESP32 S3 & MPU6050`) + live browser checks with the device online (2026-10-17)
>
> Sections 1–8 are everything the dashboard calls. Endpoints that were tested but are **not** used by the dashboard are in the Appendix, with full examples.
>
> Example payloads are **complete** — every field the server returns is kept, so new features can use them later. IDs, emails and tokens are examples, not values to hard-code.

---

## Base Configuration

| Parameter | Value |
| --- | --- |
| **Base URL** | `https://thingsboard.cloud` (developer decision — do not use `demo.thingsboard.io`) |
| **WS URL** | `wss://thingsboard.cloud` |
| **Headers on every REST call** | `Accept: application/json`; add `Content-Type: application/json` when sending a body |
| **Auth header** (all calls except §1–§2) | `X-Authorization: Bearer {token}` — ThingsBoard's own header, not `Authorization` |
| **sessionStorage keys** | `token`, `refreshToken`, `customerId`, `deviceId`, `deviceAccessToken` |

| § | Purpose | Method + path | Verified |
| --- | --- | --- | --- |
| 1 | Login | `POST /api/auth/login` | ✅ 200 |
| 2 | Refresh token | `POST /api/auth/token` | ✅ 200 |
| 3 | Customer ID | `GET /api/auth/user` | ✅ 200 |
| 4 | Device ID | `GET /api/customer/{customerId}/devices?pageSize=50&page=0` | ✅ 200 |
| 5 | Device access token | `GET /api/device/{deviceId}/credentials` | ✅ 200 (also for `CUSTOMER_USER`) |
| 6 | LED state on load | `GET /api/plugins/telemetry/DEVICE/{deviceId}/values/attributes/CLIENT_SCOPE` | ✅ 200 |
| 7 | LED command | `POST /api/rpc/twoway/{deviceId}` | ✅ 200 online · 504 offline |
| 8 | Live telemetry + LED state | `wss://…/api/ws/plugins/telemetry?token={token}` | ✅ browser (Bruno CLI cannot test WS) |

---

## 1. Authentication — Login

### `POST /api/auth/login` — no auth header

> Maps to `POST /login` in `1requirment.md`. ThingsBoard uses a **JSON body**, not HTTP Basic Auth.

**Request:**

```json
{
  "username": "customer@example.com",
  "password": "customerPassword"
}
```

**Response (200 OK):**

```json
{
  "token": "eyJhbGciOiJIUzUxMiJ9...",
  "refreshToken": "eyJhbGciOiJIUzUxMiJ9..."
}
```

| Status | Meaning | UI Action |
| --- | --- | --- |
| 401 | Invalid credentials | Show "Invalid username or password" |
| 400 | Malformed request | Show "Login request failed — check input" |
| 5xx | Server error | Show "Server unavailable — try again later" |

---

## 2. Token Refresh

### `POST /api/auth/token` — no auth header

> Maps to `POST /oauth2/token` in `1requirment.md`. Returns **both** a new `token` and a new `refreshToken`.

**Request:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzUxMiJ9..."
}
```

**Response (200 OK):**

```json
{
  "token": "eyJhbGciOiJIUzUxMiJ9...",
  "refreshToken": "eyJhbGciOiJIUzUxMiJ9..."
}
```

| Status | Meaning | UI Action |
| --- | --- | --- |
| 401 | Refresh token expired/invalid | Redirect to login page |

---

## 3. Get Current User (→ Customer ID)

### `GET /api/auth/user`

> Maps to `GET /customer/credentials` in `1requirment.md`.

**Response (200 OK):**

```json
{
  "id": {
    "entityType": "USER",
    "id": "64cd0610-ef68-11ef-8e00-e370a74757c3"
  },
  "createdTime": 1740041711857,
  "tenantId": {
    "entityType": "TENANT",
    "id": "150fa630-e4a4-11ed-a4fc-57550caf43ca"
  },
  "customerId": {
    "entityType": "CUSTOMER",
    "id": "4ac42320-ef68-11ef-8e00-e370a74757c3"
  },
  "email": "customer@example.com",
  "authority": "CUSTOMER_USER",
  "firstName": "Student",
  "lastName": "Demo",
  "phone": null,
  "version": 3,
  "name": "customer@example.com",
  "additionalInfo": {
    "description": "",
    "defaultDashboardId": null,
    "defaultDashboardFullscreen": false,
    "homeDashboardId": null,
    "homeDashboardHideToolbar": true,
    "userCredentialsEnabled": false,
    "userActivated": false,
    "lastLoginTs": null
  }
}
```

**Key field:** `customerId.id` → `{customerId}`. A non-customer account (e.g. tenant admin) has no usable `customerId`.

---

## 4. Get Customer Devices (→ Device ID)

### `GET /api/customer/{customerId}/devices?pageSize=50&page=0`

> Maps to Login flow step 4 in `1requirment.md`.

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": {
        "entityType": "DEVICE",
        "id": "f591e0a0-3af6-11f1-9681-6110e8f55c0f"
      },
      "createdTime": 1776496778154,
      "tenantId": {
        "entityType": "TENANT",
        "id": "150fa630-e4a4-11ed-a4fc-57550caf43ca"
      },
      "customerId": {
        "entityType": "CUSTOMER",
        "id": "4ac42320-ef68-11ef-8e00-e370a74757c3"
      },
      "name": "ESP32 S3 & MPU6050",
      "type": "Default",
      "label": "",
      "deviceProfileId": {
        "entityType": "DEVICE_PROFILE",
        "id": "151328a0-e4a4-11ed-a4fc-57550caf43ca"
      },
      "firmwareId": null,
      "softwareId": null,
      "externalId": null,
      "version": 3,
      "additionalInfo": {
        "gateway": false
      },
      "deviceData": {
        "configuration": { "type": "DEFAULT" },
        "transportConfiguration": { "type": "DEFAULT" }
      }
    }
  ],
  "totalPages": 1,
  "totalElements": 1,
  "hasNext": false
}
```

**Key field:** `data[0].id.id` → `{deviceId}`. `data` is empty when no device is assigned to the customer.

> **Decision required:** If multiple devices exist, select the **first device** by default. If the lab setup requires a specific device, filter by `name`.

---

## 5. Get Device Credentials (→ Access Token)

### `GET /api/device/{deviceId}/credentials`

> Maps to `GET /device/credentials` in `1requirment.md`. Returns `200` for a `CUSTOMER_USER` when the device is assigned to that customer.

**Response (200 OK):**

```json
{
  "id": {
    "id": "f593dc70-3af6-11f1-9681-6110e8f55c0f"
  },
  "createdTime": 1776496778167,
  "deviceId": {
    "entityType": "DEVICE",
    "id": "f591e0a0-3af6-11f1-9681-6110e8f55c0f"
  },
  "credentialsType": "ACCESS_TOKEN",
  "credentialsId": "A1b2C3d4E5f6G7h8I9j0",
  "credentialsValue": null,
  "version": 1
}
```

**Key field:** `credentialsId` — the plain device access token string (`credentialsType` is `ACCESS_TOKEN`).

---

## 6. Get Client Attributes (→ LED state on load)

### `GET /api/plugins/telemetry/DEVICE/{deviceId}/values/attributes/CLIENT_SCOPE`

**Response (200 OK):**

```json
[
  { "lastUpdateTs": 1791894986622, "key": "firmware_version", "value": 1 },
  { "lastUpdateTs": 1791894986622, "key": "led_state", "value": false },
  { "lastUpdateTs": 1791894986622, "key": "student_id", "value": 1234567 },
  { "lastUpdateTs": 1791896324406, "key": "firmwareVersion", "value": "1.0.0" }
]
```

> `led_state` is a real **boolean** here (REST). It is the LED state last published by the device — after every `setLed` command and on every MQTT reconnect. Attribute values can be string, number, or boolean (unlike telemetry, which is always a string).

---

## 7. RPC — LED Command

### `POST /api/rpc/twoway/{deviceId}`

> **LED control must use twoway RPC** with method `setLed` (developer decision) — the server waits for the device reply, so the dashboard can confirm the command. Path is `/api/rpc/…`, **not** `/api/plugins/rpc/…`.
>
> **Device firmware contract:** only `setLed` is handled; `params` is a plain boolean (`true` = ON). Any other method gets `{"success": false}`.

**Request:**

```json
{
  "method": "setLed",
  "params": true,
  "timeout": 5000
}
```

**Response (200 OK)** — reply from the device:

```json
{
  "success": true,
  "led_state": true
}
```

> **✅ Confirmed (2026-10-17, device online):** 200 in ~0.7 s; `led_state` in the reply always matched `params`. Device offline → `504` with an empty body after ~6.6 s.

| Status | Meaning | UI Action |
| --- | --- | --- |
| 504 / 408 | Device offline / timeout | Show "Device not responding", revert toggle |
| 0 (fetch timeout, 10 s) | No response from server | Show "Connection timed out", revert toggle |
| 401 | Token expired | Trigger reactive token refresh |
| other | Server error | Show "Command failed — retry", revert toggle |

---

## 8. WebSocket — Telemetry & Attribute Subscription

### Connection

```
wss://thingsboard.cloud/api/ws/plugins/telemetry?token={token}
```

> Use the user JWT `token` from §1 — **not** the device access token.

### Subscribe (send once after `onopen`)

```json
{
  "tsSubCmds": [
    {
      "entityType": "DEVICE",
      "entityId": "<DEVICE_ID>",
      "scope": "LATEST_TELEMETRY",
      "cmdId": 1
    }
  ],
  "historyCmds": [],
  "attrSubCmds": [
    {
      "entityType": "DEVICE",
      "entityId": "<DEVICE_ID>",
      "scope": "CLIENT_SCOPE",
      "keys": "led_state",
      "cmdId": 2
    }
  ]
}
```

> Each incoming message carries the `cmdId` of its subscription as `subscriptionId`. `keys` is optional (comma-separated); without it every client attribute is sent. The two subscriptions may also be sent as separate messages.

### Incoming — Telemetry (`subscriptionId: 1`)

```json
{
  "subscriptionId": 1,
  "errorCode": 0,
  "errorMsg": null,
  "data": {
    "mpu_temp": [[1694000000000, "23.97647"]],
    "acc_x":    [[1694000000000, "0.05"]],
    "acc_y":    [[1694000000000, "-0.02"]],
    "acc_z":    [[1694000000000, "0.98"]],
    "gyro_x":   [[1694000000000, "0.1"]],
    "gyro_y":   [[1694000000000, "-0.3"]],
    "gyro_z":   [[1694000000000, "0.0"]],
    "angle_x":  [[1694000000000, "1.2"]],
    "angle_y":  [[1694000000000, "-0.5"]],
    "angle_z":  [[1694000000000, "0.0"]]
  },
  "latestValues": {
    "mpu_temp": 1694000000000,
    "acc_x": 1694000000000,
    "acc_y": 1694000000000,
    "acc_z": 1694000000000,
    "gyro_x": 1694000000000,
    "gyro_y": 1694000000000,
    "gyro_z": 1694000000000,
    "angle_x": 1694000000000,
    "angle_y": 1694000000000,
    "angle_z": 1694000000000
  }
}
```

- Each key maps to an array of `[timestamp_ms, "value_string"]` pairs — usually one pair per update
- **All values are strings** — parse with `parseFloat()` and validate (`Number.isFinite`, § Sensor Value Ranges) before use
- The **first** message after subscribing is the stored latest value (it can be old); later messages are live
- **Without a `keys` filter the device sends every key it has ever stored** — not only the MPU keys. Confirmed on 2026-10-17:

| Key | Example value | Type | Notes |
| --- | --- | --- | --- |
| `temperature`, `humidity` | `"25.5"`, `"60"` | number as string | From Device HTTP API tests (A7) |
| `anomaly_score` | `"31.40398"` | number as string | Written by another lab / ML service |
| `normal_prob`, `unbalance_prob` | `"0.996094"`, `"0"` | number as string | Written by another lab / ML service |
| `fault` | `"unknown_anomaly"` | **text** | Not a number — `parseFloat` gives `NaN` |
| `machine_state` | `"anomaly"` | **text** | Not a number — `parseFloat` gives `NaN` |

> The dashboard must read only the keys it displays (§ Sensor Value Ranges) and ignore the rest. To receive only those keys, add `"keys": "acc_x,acc_y,acc_z,gyro_x,gyro_y,gyro_z,angle_x,angle_y,angle_z,mpu_temp"` to the `tsSubCmds` entry.

### Incoming — LED state (`subscriptionId: 2`)

```json
{
  "subscriptionId": 2,
  "errorCode": 0,
  "errorMsg": null,
  "data": {
    "led_state": [[1792224464294, "true"]]
  },
  "latestValues": {
    "led_state": 1792224464294
  }
}
```

- **Value is a string** over WebSocket (`"true"` / `"false"`) — unlike §6 (REST), which returns a boolean
- First message = current value; then one message every time the device publishes `led_state` (✅ confirmed 2026-10-17 with the live device)

---

## Sensor Value Ranges

> Referenced by `Skill.md` out-of-range guard and `1requirment.md` tilt indicator mapping. Units are what the device sends (MPU6050_light: acceleration in `g`, gyroscope in `°/s`) — display them as-is, no conversion.
>
> **Publish rate:** the firmware sends one telemetry message per second (1 Hz). In the Wokwi simulator it can arrive slower (~every 2 s observed) because the simulation runs slower than real time.

| Sensor Key | Valid Range | Unit | Notes |
| --- | --- | --- | --- |
| `acc_x` | −16.0 to +16.0 | g | MPU6050 full-scale ±16 g. Tilt indicator uses ±1 g |
| `acc_y` | −16.0 to +16.0 | g | Same as `acc_x` |
| `acc_z` | −16.0 to +16.0 | g | At rest ≈ 1.0 g (gravity) |
| `gyro_x` | −2000.0 to +2000.0 | °/s | MPU6050 full-scale ±2000 °/s |
| `gyro_y` | −2000.0 to +2000.0 | °/s | Same as `gyro_x` |
| `gyro_z` | −2000.0 to +2000.0 | °/s | Same as `gyro_x` |
| `angle_x` | −180.0 to +180.0 | ° | Computed from accelerometer |
| `angle_y` | −180.0 to +180.0 | ° | Computed from accelerometer |
| `angle_z` | −180.0 to +180.0 | ° | Computed from gyroscope integration |
| `mpu_temp` | −40.0 to +85.0 | °C | MPU6050 internal temperature sensor |
| `temperature` | −40.0 to +85.0 | °C | General temperature (not displayed in L1) |
| `humidity` | 0 to 100 | % | Relative humidity (not displayed in L1) |

---

## Appendix — Tested but Not Used by the Dashboard

Kept complete so they can be used later. Do not call them from the dashboard unless `L1/1requirment.md` asks for it.

### A1. Test Results (2026-10-13, Bruno CLI, `CUSTOMER_USER`)

| # | Endpoint | Method | Status | Result | Response Time |
| --- | --- | --- | --- | --- | --- |
| 1 | `/api/auth/login` | POST | 200 | ✅ pass | 1721 ms |
| 2 | `/api/auth/token` | POST | 200 | ✅ pass | 1086 ms |
| 3 | `/api/auth/user` | GET | 200 | ✅ pass | 1631 ms |
| 4 | `/api/customer/{customerId}/devices` | GET | 200 | ✅ pass | 1689 ms |
| 5 | `/api/device/{deviceId}` | GET | 200 | ✅ pass | 1642 ms |
| 6 | `/api/device/{deviceId}/credentials` | GET | 200 | ✅ pass | 842 ms |
| 7 | `/api/plugins/telemetry/DEVICE/{deviceId}/values/timeseries` | GET | 200 | ✅ pass | 1759 ms |
| 8 | `…/values/timeseries?keys=…&startTs=…&endTs=…` | GET | 200 | ✅ pass | 1434 ms |
| 9 | `…/values/attributes/CLIENT_SCOPE` | GET | 200 | ✅ pass | 1605 ms |
| 10 | `…/values/attributes` | GET | 200 | ✅ pass | 870 ms |
| 11 | `/api/rpc/oneway/{deviceId}` | POST | 200 | ✅ pass | 1657 ms |
| 12 | `/api/rpc/twoway/{deviceId}` | POST | 504 | device offline then — ✅ 200 on 2026-10-17 with device online (§7) | 6607 ms |
| 13 | `/api/v1/{accessToken}/telemetry` | POST | 200 | ✅ pass | 1690 ms |
| 14 | `/api/v1/{accessToken}/attributes` | POST | 200 | ✅ pass | 898 ms |
| 15 | `/api/v1/{accessToken}/rpc?timeout=20000` | GET | 408 | expected — no RPC pending | 21664 ms |
| 16 | `/api/v1/{accessToken}/rpc/{requestId}` | POST | 404 | expected — no `requestId` | 1668 ms |
| 17 | `wss://…/api/ws/plugins/telemetry?token=` | WS | error | Bruno CLI has no WS — tested in browser (§8) | — |

### A2. Get Device By Id

`GET /api/device/{deviceId}` — full details of one device.

**Response (200 OK):**

```json
{
  "id": {
    "entityType": "DEVICE",
    "id": "f591e0a0-3af6-11f1-9681-6110e8f55c0f"
  },
  "createdTime": 1776496778154,
  "tenantId": {
    "entityType": "TENANT",
    "id": "150fa630-e4a4-11ed-a4fc-57550caf43ca"
  },
  "customerId": {
    "entityType": "CUSTOMER",
    "id": "4ac42320-ef68-11ef-8e00-e370a74757c3"
  },
  "name": "ESP32 S3 & MPU6050",
  "type": "Default",
  "label": "",
  "deviceProfileId": {
    "entityType": "DEVICE_PROFILE",
    "id": "151328a0-e4a4-11ed-a4fc-57550caf43ca"
  },
  "firmwareId": null,
  "softwareId": null,
  "externalId": null,
  "version": 3,
  "additionalInfo": {
    "gateway": false
  },
  "deviceData": {
    "configuration": { "type": "DEFAULT" },
    "transportConfiguration": { "type": "DEFAULT" }
  }
}
```

### A3. Get Latest Telemetry (REST)

`GET /api/plugins/telemetry/DEVICE/{deviceId}/values/timeseries` — most recent value per key.

**Response (200 OK):**

```json
{
  "humidity":    [{ "ts": 1789624284873, "value": "60" }],
  "temperature": [{ "ts": 1789624284873, "value": "25.5" }],
  "acc_x":       [{ "ts": 1789623471514, "value": "0" }],
  "acc_y":       [{ "ts": 1789623471514, "value": "0" }],
  "acc_z":       [{ "ts": 1789623471514, "value": "1" }],
  "gyro_x":      [{ "ts": 1789623471514, "value": "0" }],
  "gyro_y":      [{ "ts": 1789623471514, "value": "0" }],
  "gyro_z":      [{ "ts": 1789623471514, "value": "0" }],
  "angle_x":     [{ "ts": 1789623471514, "value": "0" }],
  "angle_y":     [{ "ts": 1789623471514, "value": "0" }],
  "angle_z":     [{ "ts": 1789623471514, "value": "0" }],
  "mpu_temp":    [{ "ts": 1789623471514, "value": "23.97647" }]
}
```

> Values are strings. Keys seen on 2026-10-13: `humidity`, `temperature`, `acc_x`, `acc_y`, `acc_z`, `gyro_x`, `gyro_y`, `gyro_z`, `angle_x`, `angle_y`, `angle_z`, `mpu_temp`. On 2026-10-17 the device also had `anomaly_score`, `fault`, `machine_state`, `normal_prob`, `unbalance_prob` (see §8).

### A4. Get Telemetry History (REST)

`GET /api/plugins/telemetry/DEVICE/{deviceId}/values/timeseries?keys={keys}&startTs={startTs}&endTs={endTs}&interval={interval}&limit={limit}&agg={agg}` — out of scope for L1.

| Parameter | Type | Required | Example | Description |
| --- | --- | --- | --- | --- |
| `keys` | string | Yes | `mpu_temp,acc_x,acc_y,acc_z` | Comma-separated telemetry keys |
| `startTs` | number | Yes | `1789617600000` | Start timestamp (epoch ms) |
| `endTs` | number | Yes | `1789617900000` | End timestamp (epoch ms) |
| `interval` | number | No | `0` | Aggregation interval in ms (0 = none) |
| `limit` | number | No | `1000` | Max data points per key |
| `agg` | string | No | `NONE` | `NONE`, `MIN`, `MAX`, `AVG`, `SUM`, `COUNT` |

**Response (200 OK):**

```json
{
  "mpu_temp": [
    { "ts": 1789623471514, "value": "23.97647" },
    { "ts": 1789623470449, "value": "23.97647" }
  ],
  "acc_x": [
    { "ts": 1789623471514, "value": "0" },
    { "ts": 1789623470449, "value": "0" }
  ]
}
```

> Sorted by timestamp **descending**. Returns `{}` when the range has no data.

### A5. Get All Attributes (all scopes)

`GET /api/plugins/telemetry/DEVICE/{deviceId}/values/attributes` — CLIENT, SERVER and SHARED scope together.

**Response (200 OK):**

```json
[
  { "lastUpdateTs": 1791894986622, "key": "firmware_version", "value": 1 },
  { "lastUpdateTs": 1791894986622, "key": "led_state", "value": false },
  { "lastUpdateTs": 1791894986622, "key": "student_id", "value": 1234567 },
  { "lastUpdateTs": 1791896324406, "key": "firmwareVersion", "value": "1.0.0" },
  { "lastUpdateTs": 1791895318776, "key": "lastDisconnectTime", "value": 1791895318776 },
  { "lastUpdateTs": 1791896325655, "key": "active", "value": true },
  { "lastUpdateTs": 1791894986016, "key": "lastConnectTime", "value": 1791894986016 },
  { "lastUpdateTs": 1791896328641, "key": "lastActivityTime", "value": 1791896326033 },
  { "lastUpdateTs": 1791895972901, "key": "inactivityAlarmTime", "value": 1791895972897 }
]
```

### A6. Oneway RPC

`POST /api/rpc/oneway/{deviceId}` — fire-and-forget; **cannot** confirm the LED, so the dashboard uses §7 instead.

**Request:**

```json
{
  "method": "setLed",
  "params": true,
  "timeout": 5000
}
```

**Response (200 OK):** empty body `""`

### A7. Device HTTP API (device side)

Used by a device or a simulation, **not** the dashboard. Auth is the device `accessToken` in the URL (§5), not the JWT.

`POST /api/v1/{accessToken}/telemetry` — publish telemetry → `200`, empty body

```json
{
  "temperature": 25.5,
  "humidity": 60
}
```

`POST /api/v1/{accessToken}/attributes` — publish client attributes → `200`, empty body

```json
{
  "firmwareVersion": "1.0.0"
}
```

`GET /api/v1/{accessToken}/rpc?timeout=20000` — long-poll for an incoming RPC (`408` when nothing arrives)

`POST /api/v1/{accessToken}/rpc/{requestId}` — reply to that RPC (`404` without a valid `requestId`)

```json
{
  "result": "ok"
}
```

> The ESP32 firmware itself uses **MQTT** (`v1/devices/me/telemetry`, `v1/devices/me/attributes`, `v1/devices/me/rpc/request/+`), not this HTTP API.
