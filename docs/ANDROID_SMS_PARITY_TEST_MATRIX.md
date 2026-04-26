# Android SMS Parity Test Matrix

Use this matrix on physical Android devices to validate Kotlin-parity SMS ingestion behavior.

## Preconditions
- Build and install Android app/dev client with SMS module enabled.
- Sign in with a test account.
- Open `Settings -> SMS diagnostics`.
- Grant `READ_SMS` and `RECEIVE_SMS`.

## Test Cases

1. Inbox historical import
- Action: Tap `Run Inbox Import (30)`.
- Expected:
  - Parses recent MPESA/M-PESA messages.
  - Inserts only non-duplicate messages.
  - Adds audit rows for imported/duplicate/low-confidence.

2. Realtime foreground capture
- Action: Keep app open, send a new M-PESA SMS to device.
- Expected:
  - Message ingests automatically within seconds.
  - New transaction appears after sync.
  - Audit row source indicates Android SMS ingestion.

3. Process-death background capture
- Action: Force close app process. Send M-PESA SMS. Re-open app.
- Expected:
  - Startup drains queued native messages.
  - Message ingests on launch without manual inbox import.
  - Queue-drain run in diagnostics reports processed count.

4. Permission denial and recovery
- Action: Revoke SMS permissions in Android settings.
- Expected:
  - Diagnostics shows missing permission status.
  - Inbox import yields no data until permission is granted.
  - After `Request`, permissions become granted and import works.

5. Duplicate suppression
- Action: Run inbox import twice consecutively.
- Expected:
  - First run inserts eligible rows.
  - Second run mostly reports duplicates with no extra transaction clones.

6. Low-confidence quarantine
- Action: In diagnostics, run `Synthetic Edge Cases`.
- Expected:
  - Non-structured messages become `LOW_CONFIDENCE` / review status.
  - They are audited without corrupting finance totals.

7. Classification sanity
- Inputs:
  - Sent payment
  - Paybill payment
  - Received transfer
  - Fuliza charge
- Expected:
  - Types classify correctly (`SENT`, `PAYBILL`, `RECEIVED`, `FULIZA_CHARGE`).
  - Merchant extraction remains readable and not over-captured.

8. Sync repair path
- Action: Simulate sync failure (disconnect network), then reconnect and tap `Repair` on Home.
- Expected:
  - Failed jobs recover via `REPAIR_ALL`.
  - Banner updates to healthy state when queue clears.

## Exit Criteria
- All test cases pass on at least:
  - 1 low/mid Android device
  - 1 modern Android device
- No duplicate or missing transaction regressions observed.
- No unresolved failed sync jobs after final repair run.
