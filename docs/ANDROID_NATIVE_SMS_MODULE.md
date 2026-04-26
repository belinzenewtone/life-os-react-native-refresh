# Android SMS Native Module (LifeOsSmsModule)

This project now includes a local RN Android native package at:
- `modules/lifeos-sms-native`

## What it provides
- Native module name: `LifeOsSmsModule`
- Methods:
  - `readMpesaInbox(limit)` -> reads SMS inbox rows matching MPESA markers
  - `drainQueuedMpesaMessages(limit)` -> drains queued background-captured MPESA messages
  - `startMpesaReceiver()` -> dynamically registers `SMS_RECEIVED` broadcast receiver
  - `stopMpesaReceiver()` -> unregisters dynamic receiver
- Event:
  - `LifeOsSmsReceived` -> emitted to JS with `{ body, address, timestamp }`

## Background capture behavior
- Manifest receiver `MpesaSmsReceiver` captures `SMS_RECEIVED` even when app process is cold.
- Captured MPESA messages are appended to a bounded shared-preferences queue (`SmsQueueStore`).
- On next app launch, bootstrap drains queue via `drainQueuedMpesaMessages` and ingests into finance DB.
- While app is active, dynamic receiver also emits realtime JS events for immediate ingestion.

## Package wiring
- Dependency is declared in root `package.json` as:
  - `"lifeos-sms-native": "file:modules/lifeos-sms-native"`
- Android autolink metadata is declared in:
  - `modules/lifeos-sms-native/react-native.config.js`

## Integration points in app code
- JS gateway: `src/core/platform/sms/android-sms-gateway.ts`
- Finance import flow prefers native inbox read when available.
- App bootstrap starts/stops receiver hooks on auth state transitions and auto-ingests realtime M-Pesa messages.

## To activate in native builds
1. Run `npx expo prebuild --platform android`.
2. Build dev client / APK from generated Android project.
3. Grant `READ_SMS` and `RECEIVE_SMS` runtime permissions on device.
4. Validate `AndroidSmsGateway.isAvailable()` returns true.

## Notes
- Current integration includes both manifest receiver queue capture and dynamic in-process event capture.
- iOS keeps sync-based strategy (no SMS inbox access).
