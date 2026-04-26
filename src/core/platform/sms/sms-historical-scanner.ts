/**
 * SMS Historical Scanner
 *
 * Backfills M-Pesa SMS from the device's inbox for the last N days.
 * Uses the native AndroidSmsGateway to query content://sms/inbox.
 *
 * Design:
 *   1. Tracks last scan timestamp per user (stored in SecureStore)
 *   2. On first scan: fetches last 90 days (configurable)
 *   3. On subsequent scans: fetches since last scan timestamp
 *   4. Processes messages oldest-first to maintain chronological order
 *   5. Deduplication is handled by MpesaIngestionService
 *   6. Tracks scan metrics for diagnostics
 */

import * as SecureStore from 'expo-secure-store';
import { AndroidSmsGateway } from './android-sms-gateway';
import { MpesaIngestionService } from './mpesa-ingestion-service';
import { AppTelemetry } from '@/core/observability/app-telemetry';

const LAST_SMS_SCAN_KEY = 'lifeos.last_sms_scan_timestamp';
const DEFAULT_BACKFILL_DAYS = 90;
const INBOX_QUERY_LIMIT = 500;

export type HistoricalScanResult = {
  scanned: number;
  imported: number;
  duplicates: number;
  failed: number;
  ignored: number;
  oldestTimestamp: number | null;
  newestTimestamp: number | null;
};

export class SmsHistoricalScanner {
  /**
   * Scans the SMS inbox for M-Pesa messages and ingests them.
   *
   * @param userId - Current user ID
   * @param options.backfillDays - How many days to look back on first scan (default: 90)
   * @param options.sinceTimestamp - Override: scan from this timestamp instead of last scan
   */
  static async scan(userId: string, options?: { backfillDays?: number; sinceTimestamp?: number }): Promise<HistoricalScanResult> {
    if (!AndroidSmsGateway.isAvailable()) {
      throw new Error('SMS scanner is only available on Android');
    }

    const backfillDays = options?.backfillDays ?? DEFAULT_BACKFILL_DAYS;
    const now = Date.now();
    const defaultCutoff = now - backfillDays * 24 * 60 * 60 * 1000;

    // Determine scan window
    const lastScan = options?.sinceTimestamp ?? (await this.getLastScanTimestamp()) ?? defaultCutoff;
    const since = Math.max(lastScan, defaultCutoff);

    // Fetch from native module
    const messages = await AndroidSmsGateway.readMpesaInbox(INBOX_QUERY_LIMIT);

    // Filter to scan window and sort oldest-first
    const relevant = messages
      .filter((m) => (m.timestamp ?? 0) >= since)
      .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

    const result: HistoricalScanResult = {
      scanned: relevant.length,
      imported: 0,
      duplicates: 0,
      failed: 0,
      ignored: 0,
      oldestTimestamp: relevant[0]?.timestamp ?? null,
      newestTimestamp: relevant[relevant.length - 1]?.timestamp ?? null,
    };

    if (relevant.length === 0) {
      await this.setLastScanTimestamp(now);
      return result;
    }

    // Process each message through the ingestion pipeline
    for (const message of relevant) {
      try {
        const outcome = await MpesaIngestionService.ingestSms(userId, message.body, message.timestamp);

        if ('error' in outcome && outcome.error) {
          result.failed += 1;
        } else if (outcome.duplicate) {
          result.duplicates += 1;
        } else if ('outcome' in outcome && outcome.outcome === 'PARSE_FAILED') {
          result.ignored += 1;
        } else if (outcome.inserted) {
          result.imported += 1;
        } else if ('outcome' in outcome && (outcome.outcome === 'FULIZA_BALANCE_UPDATED')) {
          // Fuliza updates are successful but not counted as transactions
          result.imported += 1;
        } else {
          result.ignored += 1;
        }
      } catch {
        result.failed += 1;
      }
    }

    // Update last scan timestamp to the newest processed message
    await this.setLastScanTimestamp(result.newestTimestamp ?? now);

    AppTelemetry.trackEvent('sms_historical_scan', {
      user_id: userId,
      scanned: String(result.scanned),
      imported: String(result.imported),
      duplicates: String(result.duplicates),
      failed: String(result.failed),
      ignored: String(result.ignored),
      window_start: new Date(since).toISOString(),
      window_end: new Date(now).toISOString(),
    });

    return result;
  }

  /**
   * Returns the timestamp of the last successful scan, or null if never scanned.
   */
  static async getLastScanTimestamp(): Promise<number | null> {
    const raw = await SecureStore.getItemAsync(LAST_SMS_SCAN_KEY);
    if (!raw) return null;
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? null : parsed;
  }

  private static async setLastScanTimestamp(timestamp: number): Promise<void> {
    await SecureStore.setItemAsync(LAST_SMS_SCAN_KEY, String(timestamp));
  }
}
