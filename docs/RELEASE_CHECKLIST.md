# LifeOS RN Release Checklist

## 1) Environment and config
- Populate `.env` from `.env.example`.
- Verify:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `EXPO_PUBLIC_ASSISTANT_PROXY_URL`
  - `EXPO_PUBLIC_BINARY_VERSION_ENDPOINT`

## 2) Local verification
- Run:
  - `npm ci`
  - `npm run verify`
  - `npm run release:prepare`
- Confirm no lint/type/test failures.

## 3) Native build validation
- Generate native Android project:
  - `npx expo prebuild --platform android --no-install`
- Validate autolinking includes `lifeos-sms-native`:
  - `npx expo-modules-autolinking react-native-config --platform android --json`
- On Android test device:
  - grant `READ_SMS`, `RECEIVE_SMS`, notifications
  - verify manual inbox import
  - verify realtime SMS ingestion
  - verify process-death queue drain on relaunch

## 4) OTA + binary update policy
- OTA (JS/assets):
  - publish to correct EAS channel (`development`, `staging`, `production`).
  - confirm runtime compatibility (`runtimeVersion.policy = appVersion`).
  - keep `ota/manifest.json` in sync via `npm run release:sync-manifests`.
- Binary (native changes):
  - increment app version.
  - ship new store/internal build.
  - update binary manifest endpoint payload (`minimumVersion`, `latestVersion`, store URLs) in `ota/binary-version.json`.

## 5) Release gates
- Auth and onboarding flow pass.
- Sync health:
  - no persistent failed jobs
  - `Repair` flow succeeds after simulated failure.
- Finance parity:
  - budgets, imports, categorize, merchant detail.
- Assistant proposal-confirm flow:
  - task creation
  - expense logging
- Calendar/tasks reminders functioning.
- Run parity E2E flows and archive evidence as per `docs/PARITY_E2E_RUNBOOK.md`.

## 6) Promote rollout
- Internal -> beta -> production.
- Monitor crash-free rate, sync failure rates, and import-audit anomalies.
