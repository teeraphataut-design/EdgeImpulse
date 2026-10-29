# Signal Lab

Current milestone: live dashboard implemented; awaiting human verification of streaming, LED control, responsive layout and logout. Real customer login/discovery confirmed by user screenshot.

## Open locally

From the repository root in a PowerShell terminal:

```powershell
& "$env:USERPROFILE/.platformio/penv/Scripts/python.exe" -m http.server 8080 --bind 127.0.0.1 --directory loopEngineering/DemoApp
```

Open http://127.0.0.1:8080/login.html. Keep this terminal open; Ctrl+C stops the server. Alternatively serve this directory with your existing VS Code Live Server extension. Do not open through file:// because JavaScript modules require HTTP.

## Login checkpoint

1. Submit empty fields: a clear error appears and focus moves to the missing field.
2. At widths 320px, 768px and 1280px: fields and button remain usable without horizontal scrolling; check keyboard Tab focus.
3. Sign in with your own thingsboard.cloud **Customer User**. Enter credentials only in the local login form, not in chat. Your ESP32 device must be assigned to that Customer. The app selects the first assigned device as required by the assignment.
4. Successful login opens the dashboard with a Device ID. Start Wokwi and confirm the eight-second acceleration chart, ten sensor tiles and tilt dot update. The socket can be connected while the device is offline: check the latest-data time and stale-data warning.
5. Toggle LED and verify the physical/simulated LED and confirmed switch state. Stop Wokwi, try a command and confirm an error with rollback. Change MPU acceleration in Wokwi and confirm values/tilt move.
5. Logout returns to login. Opening dashboard.html without a session redirects to login.
6. Wrong password or an unassigned customer shows a readable error, releases the loading button, and stays on login.

Save screenshots of login and the completed dashboard under evidence/ for the homework. The earlier user-provided dashboard-shell screenshot is baseline evidence in the conversation; it has not been saved locally. Before/after review, remaining live checks and the homework report are pending. Review screenshots for private data before sharing.

## Validation

`tests/auth.test.mjs` exports `runAuthTests(root)` for a Node runtime. It mocks fetch/sessionStorage/location, makes no network requests, and restores globals afterwards. Results from the executed suite are in `evidence/auth-tests.json`. This does not establish real account permissions, CORS behavior, browser layout, or a real elapsed ten-second timeout (the abort test simulates AbortError).

No passwords or production tokens are included in the web app. JWTs/device credentials are held in sessionStorage only. No custom backend, dependency installation, or frontend build step is required. package.json only declares ES module syntax for local Node verification.
