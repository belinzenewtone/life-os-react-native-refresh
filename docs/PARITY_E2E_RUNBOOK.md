# LifeOS Parity E2E Runbook

Use this runbook during internal/beta release gates.

## 1) Build and install
- Android: latest internal build from `preview` or `production` profile.
- iOS: latest TestFlight/internal build from matching profile.
- Ensure the build version matches `ota/binary-version.json`.

## 2) Run common flows (both platforms)
- `maestro test e2e/maestro/auth-onboarding-flow.yaml`
- `maestro test e2e/maestro/core-tab-navigation-flow.yaml`
- `maestro test e2e/maestro/assistant-proposal-flow.yaml`

## 3) Platform-specific finance parity
- Android only:
  - `maestro test e2e/maestro/finance-android-sms-flow.yaml`
  - Validate SMS diagnostics screen and import health changes.
- iOS only:
  - `maestro test e2e/maestro/finance-ios-cloud-flow.yaml`
  - Validate cloud refresh path and finance list parity.

## 4) Evidence to capture
- Full Maestro logs per flow.
- Screenshot at each major section entry (Home, Finance, Calendar, Assistant, Profile).
- Android SMS diagnostics screenshot after run.
- iOS finance refresh screenshot after run.
- Pass/fail summary with failing step and reproduction notes.

## 5) Release gate criteria
- No critical blocker in auth, navigation, assistant confirm, finance ingestion/sync paths.
- Sync status has no persistent failed jobs after manual `Repair`.
- OTA check works and binary prompt behavior matches `ota/binary-version.json`.
