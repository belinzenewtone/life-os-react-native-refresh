import { getDatabase } from '@/core/data/database/client';

export type InsightCardRecord = {
  id: string;
  kind: string;
  title: string;
  body: string;
  priority: number;
  dismissed: number;
  created_at: string;
  expires_at: string | null;
  refreshed_at: string | null;
  stale_after_hours: number | null;
};

function nowIso() {
  return new Date().toISOString();
}

function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export class InsightCardRepository {
  /** Returns non-dismissed, non-expired, non-stale cards ordered by priority desc, then newest first. */
  static async listActive(userId: string): Promise<InsightCardRecord[]> {
    const db = await getDatabase();
    const now = nowIso();
    return db.getAllAsync<InsightCardRecord>(
      `SELECT id,kind,title,body,priority,dismissed,created_at,expires_at,refreshed_at,stale_after_hours
         FROM insight_cards
         WHERE user_id = ?
           AND dismissed = 0
           AND (expires_at IS NULL OR expires_at > ?)
           AND (
             stale_after_hours IS NULL
             OR (
               (
                 refreshed_at IS NOT NULL
                 AND datetime(refreshed_at, '+' || stale_after_hours || ' hours') > ?
               )
               OR (
                 refreshed_at IS NULL
                 AND datetime(created_at, '+' || stale_after_hours || ' hours') > ?
               )
             )
           )
         ORDER BY priority DESC, created_at DESC`,
      userId,
      now,
      now,
      now,
    );
  }

  /** Marks an insight as refreshed (extends its freshness). */
  static async refresh(userId: string, id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE insight_cards SET refreshed_at = ?, updated_at = ?, sync_state = ? WHERE user_id = ? AND id = ?`,
      nowIso(),
      nowIso(),
      'QUEUED',
      userId,
      id,
    );
  }

  /** Deletes stale insights that have exceeded their freshness window. */
  static async pruneStale(userId: string): Promise<number> {
    const db = await getDatabase();
    const now = nowIso();
    const result = await db.runAsync(
      `DELETE FROM insight_cards
       WHERE user_id = ?
         AND dismissed = 0
         AND stale_after_hours IS NOT NULL
         AND refreshed_at IS NOT NULL
         AND datetime(refreshed_at, '+' || stale_after_hours || ' hours') < ?`,
      userId,
      now,
    );
    return result.changes ?? 0;
  }

  static async insert(
    userId: string,
    input: {
      kind: string;
      title: string;
      body: string;
      priority?: number;
      expires_at?: string | null;
    },
  ): Promise<string> {
    const db = await getDatabase();
    const id = genId('insight');
    const created = nowIso();
    await db.runAsync(
      `INSERT INTO insight_cards
         (user_id,id,kind,title,body,priority,dismissed,created_at,expires_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      userId,
      id,
      input.kind,
      input.title,
      input.body,
      input.priority ?? 0,
      0,
      created,
      input.expires_at ?? null,
    );
    return id;
  }

  static async dismiss(userId: string, id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE insight_cards SET dismissed = 1 WHERE user_id = ? AND id = ?',
      userId,
      id,
    );
  }
}
