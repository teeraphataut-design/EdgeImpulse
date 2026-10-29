## [2026-10-19] ThingsBoard host and account role

- **Question**: Which ThingsBoard host and account role does the user use?
- **Answer**: thingsboard.cloud — Tenant Admin.
- **Impact**: The host matches the API contract, but the account role conflicts with the customer-only login and device-discovery requirements. Ask the user whether to retain the assignment's Customer User flow or adapt the application for Tenant Admin before implementation. Do not treat this account-role answer as approval to change scope.
## [2026-10-19] Follow the Customer User assignment

- **Question**: Retain the Customer User flow or adapt for Tenant Admin?
- **Answer**: Option 1: follow the assignment. The user also has a Customer User account.
- **Impact**: All questions resolved — proceeding to planning. Use thingsboard.cloud, customer-scoped discovery, and the first assigned device as specified. No Tenant Admin support or device picker.

## [2026-10-19] Login checkpoint feedback

- **Question**: Can the user reach the protected dashboard with the real Customer User?
- **Answer**: User supplied a screenshot showing successful connection and a Device ID after adjusting ThingsBoard user setup.
- **Impact**: Live login and discovery confirmed; proceed with dashboard widgets. This does not confirm logout, all viewport sizes, telemetry, or RPC.

## [2026-10-19] Live LED verification

- **Question**: Does login and LED control work with the running Wokwi device?
- **Answer**: User confirmed login works and switching LED on/off makes the LED respond in Wokwi.
- **Impact**: Live login and LED on/off behavior confirmed by human observation. Telemetry/chart/tilt, disconnect rollback, logout and responsive layouts remain unconfirmed.

## [2026-10-19] Live telemetry feedback

- **Question**: Does changing MPU-6050 values in Wokwi update the web dashboard?
- **Answer**: User confirmed that changing the values makes the website change accordingly.
- **Impact**: Live sensor-to-web updates confirmed. The reply does not separately establish every chart/tilt detail, offline rollback, logout or responsive layouts.

## [2026-10-19] Logout and offline LED feedback

- **Question**: Does logout work, and does a command with Wokwi stopped show a device-not-responding error?
- **Answer**: User confirmed logout works, then confirmed stopping Wokwi and sending an LED command shows not responding.
- **Impact**: Logout navigation and offline-command error display verified by human. Session-key cleanup, switch rollback and reconnect timing have not been separately observed.

