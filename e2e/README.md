# LifeOS E2E (Maestro)

This directory contains parity-focused mobile E2E flows for manual/beta validation.

## Prerequisites
- [Maestro CLI](https://maestro.mobile.dev/getting-started/installing-maestro)
- Android or iOS build installed on device/simulator
- App launched and stable on the first screen

## Run
```bash
maestro test e2e/maestro/auth-onboarding-flow.yaml
maestro test e2e/maestro/core-tab-navigation-flow.yaml
maestro test e2e/maestro/assistant-proposal-flow.yaml
maestro test e2e/maestro/finance-android-sms-flow.yaml
maestro test e2e/maestro/finance-ios-cloud-flow.yaml
```

## Notes
- Android SMS ingestion flow must run on Android only.
- iOS cloud-finance flow must run on iOS only.
- Keep screenshots/logs per run and attach them to release evidence.
