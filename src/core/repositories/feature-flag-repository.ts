import { getDatabase } from '@/core/data/database/client';

export class FeatureFlagRepository {
  static async get(userId: string, key: string): Promise<boolean> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ enabled: number }>(
      'SELECT enabled FROM feature_flags WHERE user_id = ? AND key = ?',
      userId,
      key,
    );
    return row ? Boolean(row.enabled) : false;
  }

  static async set(userId: string, key: string, enabled: boolean): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO feature_flags (user_id, key, enabled, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, key) DO UPDATE SET enabled=excluded.enabled, updated_at=excluded.updated_at`,
      userId,
      key,
      enabled ? 1 : 0,
      now,
    );
  }

  static async list(userId: string): Promise<{ key: string; enabled: boolean }[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ key: string; enabled: number }>(
      'SELECT key, enabled FROM feature_flags WHERE user_id = ? ORDER BY key',
      userId,
    );
    return rows.map((r) => ({ key: r.key, enabled: Boolean(r.enabled) }));
  }
}
