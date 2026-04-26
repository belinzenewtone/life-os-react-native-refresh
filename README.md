# LifeOS React Native Refresh (Expo SDK 55)

LifeOS rewrite in React Native + Expo with parity-focused architecture:
- `UI -> ViewModel/Hook -> UseCase -> Repository -> Source`
- Supabase-backed auth/sync
- Offline-first SQLite persistence
- Android-native M-Pesa SMS ingestion path + iOS cloud-sync parity path
- OTA updates through EAS Update + binary update prompt checks

## Current Status
- Core shell, auth/onboarding guards, tab navigation, biometric overlay, OTA prompt host: implemented.
- Productivity and finance flows: implemented.
- Android SMS ingestion + diagnostics: implemented.
- Sync queue/backoff/circuit-breaker + repair flows: implemented.
- Shared route contracts and finance intelligence usecases: implemented with tests.
- Test suite: `45` passing tests.

Detailed changelog/status: `docs/IMPLEMENTATION_STATUS.md`.

## Local Setup
1. Install dependencies
```bash
npm install
```

2. Configure env
```bash
cp .env.example .env
```
Populate:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_ASSISTANT_PROXY_URL` (optional)
- `EXPO_PUBLIC_BINARY_VERSION_ENDPOINT` (optional)

3. Start app
```bash
npx expo start
```

## Verification
Run the full quality gate:
```bash
npm run verify
```
This runs:
- `npm run typecheck`
- `npm run lint`
- `npm run test`

Release-prep gate:
```bash
npm run release:prepare
```

## Key Docs
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/RELEASE_CHECKLIST.md`
- `docs/ANDROID_SMS_PARITY_TEST_MATRIX.md`
- `docs/ANDROID_NATIVE_SMS_MODULE.md`
- `docs/PARITY_E2E_RUNBOOK.md`

## Release Notes
- OTA channels: `development`, `staging`, `production`
- Runtime compatibility policy is configured for binary-safe OTA rollout.
- Native-runtime changes require new binary builds (see release checklist).
