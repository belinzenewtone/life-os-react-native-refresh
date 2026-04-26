/**
 * Import Audit Pruner
 *
 * Periodically cleans up old import audit records to prevent unbounded
 * database growth. Retains the most recent 90 days of audit history.
 *
 * Called from the background task scheduler.
 */

import { getDatabase } from '@/core/data/database/client';
import { AppTelemetry } from '@/core/observability/app-telemetry';

const RETENTION_DAYS = 90;

export class ImportAuditPruner {
  /**
   * Deletes import audit records older than the retention period.
   * Returns the number of records deleted.
   */
  static async prune(userId: string): Promise<number> {
    const db = await getDatabase();
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const result = await db.runAsync(
      'DELETE FROM import_audit WHERE user_id = ? AND created_at < ?',
      userId,
      cutoff,
    );

    const deletedCount = result.changes ?? 0;

    AppTelemetry.trackEvent('import_audit_pruned', {
      user_id: userId,
      deleted: String(deletedCount),
      retention_days: String(RETENTION_DAYS),
      cutoff,
    });

    return deletedCount;
  }
}
