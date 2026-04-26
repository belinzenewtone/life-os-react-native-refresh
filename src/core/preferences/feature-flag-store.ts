/**
 * Feature Flag Store
 *
 * Runtime feature toggles backed by SQLite with optional remote fetch from Supabase.
 *
 * Local flags are persisted in the `feature_flags` table and can be overridden
 * by remote values fetched from the `feature_flags` Supabase table.
 *
 * Resolution order (highest priority wins):
 *   1. Remote value (if fetched recently and remote_override is true)
 *   2. Local forced value (if user/admin explicitly set it)
 *   3. Default value (from code)
 */

import { getDatabase } from '@/core/data/database/client';
import { supabaseClient } from '@/core/supabase/client';
import { AppTelemetry } from '@/core/observability/app-telemetry';

export type FeatureFlagDef = {
  key: string;
  defaultValue: boolean;
  description: string;
  remoteOverride: boolean; // Can remote update this flag?
};

const DEFAULT_FLAGS: FeatureFlagDef[] = [
  { key: 'dark_mode', defaultValue: true, description: 'Enable dark mode support', remoteOverride: false },
  { key: 'sms_auto_import', defaultValue: true, description: 'Auto-import M-Pesa SMS', remoteOverride: true },
  { key: 'biometric_lock', defaultValue: true, description: 'Enable biometric app lock', remoteOverride: false },
  { key: 'cloud_sync', defaultValue: true, description: 'Enable cloud synchronization', remoteOverride: true },
  { key: 'insights_v2', defaultValue: false, description: 'Enable v2 insight engine', remoteOverride: true },
  { key: 'fuliza_tracking', defaultValue: true, description: 'Enable Fuliza loan tracking', remoteOverride: true },
  { key: 'assistant_proxy', defaultValue: false, description: 'Use remote AI proxy instead of local', remoteOverride: true },
];

const REMOTE_FETCH_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export class FeatureFlagStore {
  private static lastRemoteFetch = 0;

  /**
   * Returns the effective value of a feature flag.
   */
  static async isEnabled(userId: string, key: string): Promise<boolean> {
    const def = DEFAULT_FLAGS.find((f) => f.key === key);
    const defaultValue = def?.defaultValue ?? false;

    const db = await getDatabase();
    const row = await db.getFirstAsync<{
      enabled: number;
      source: string | null;
      updated_at: string;
    }>(
      'SELECT enabled, source, updated_at FROM feature_flags WHERE user_id = ? AND key = ?',
      userId,
      key,
    );

    if (!row) return defaultValue;
    return Boolean(row.enabled);
  }

  /**
   * Sets a local override for a feature flag.
   */
  static async set(userId: string, key: string, enabled: boolean): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO feature_flags (user_id, key, enabled, source, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, key) DO UPDATE SET enabled=excluded.enabled, source='LOCAL', updated_at=excluded.updated_at`,
      userId,
      key,
      enabled ? 1 : 0,
      'LOCAL',
      now,
    );
  }

  /**
   * Returns all feature flags with their current effective values.
   */
  static async list(userId: string): Promise<{ key: string; enabled: boolean; source: string; description: string }[]> {
    const values = await Promise.all(
      DEFAULT_FLAGS.map(async (def) => {
        const enabled = await this.isEnabled(userId, def.key);
        const db = await getDatabase();
        const row = await db.getFirstAsync<{ source: string | null }>(
          'SELECT source FROM feature_flags WHERE user_id = ? AND key = ?',
          userId,
          def.key,
        );
        return {
          key: def.key,
          enabled,
          source: row?.source ?? 'DEFAULT',
          description: def.description,
        };
      }),
    );
    return values;
  }

  /**
   * Fetches remote feature flags from Supabase and updates local overrides.
   * Respects the remoteOverride setting per flag.
   */
  static async fetchRemote(userId: string): Promise<void> {
    const now = Date.now();
    if (now - this.lastRemoteFetch < REMOTE_FETCH_COOLDOWN_MS) return;
    this.lastRemoteFetch = now;

    try {
      const { data, error } = await supabaseClient
        .from('feature_flags')
        .select('key,enabled')
        .eq('user_id', userId);

      if (error || !data?.length) return;

      const db = await getDatabase();
      const ts = new Date().toISOString();

      for (const remote of data as { key: string; enabled: boolean }[]) {
        const def = DEFAULT_FLAGS.find((f) => f.key === remote.key);
        if (!def?.remoteOverride) continue; // Skip flags that don't allow remote override

        await db.runAsync(
          `INSERT INTO feature_flags (user_id, key, enabled, source, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(user_id, key) DO UPDATE SET enabled=excluded.enabled, source='REMOTE', updated_at=excluded.updated_at`,
          userId,
          remote.key,
          remote.enabled ? 1 : 0,
          'REMOTE',
          ts,
        );
      }

      AppTelemetry.trackEvent('feature_flags_fetched', { count: String(data.length) });
    } catch (err) {
      AppTelemetry.captureError(err, { context: 'feature_flags_remote_fetch' });
    }
  }

  /**
   * Seeds default flags for a new user.
   */
  static async seedDefaults(userId: string): Promise<void> {
    const db = await getDatabase();
    const ts = new Date().toISOString();
    for (const def of DEFAULT_FLAGS) {
      await db.runAsync(
        `INSERT OR IGNORE INTO feature_flags (user_id, key, enabled, source, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        userId,
        def.key,
        def.defaultValue ? 1 : 0,
        'DEFAULT',
        ts,
      );
    }
  }
}
