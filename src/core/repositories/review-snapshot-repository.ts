import { getDatabase } from '@/core/data/database/client';

export type ReviewSnapshotRecord = {
  id: string;
  period: string;
  period_key: string;
  payload: string;
  created_at: string;
};

function nowIso() {
  return new Date().toISOString();
}

function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export class ReviewSnapshotRepository {
  static async insert(
    userId: string,
    period: string,
    periodKey: string,
    payloadJson: string,
  ): Promise<string> {
    const db = await getDatabase();
    const id = genId('review');
    const created = nowIso();
    await db.runAsync(
      `INSERT INTO review_snapshots (user_id,id,period,period_key,payload,created_at)
       VALUES (?,?,?,?,?,?)`,
      userId,
      id,
      period,
      periodKey,
      payloadJson,
      created,
    );
    return id;
  }

  /** Returns the most recent snapshot for the given period, or null. */
  static async latest(userId: string, period: string): Promise<ReviewSnapshotRecord | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<ReviewSnapshotRecord>(
      `SELECT id,period,period_key,payload,created_at
         FROM review_snapshots
         WHERE user_id = ? AND period = ?
         ORDER BY created_at DESC
         LIMIT 1`,
      userId,
      period,
    );
    return row ?? null;
  }

  static async listForPeriod(userId: string, period: string): Promise<ReviewSnapshotRecord[]> {
    const db = await getDatabase();
    return db.getAllAsync<ReviewSnapshotRecord>(
      `SELECT id,period,period_key,payload,created_at
         FROM review_snapshots
         WHERE user_id = ? AND period = ?
         ORDER BY created_at DESC`,
      userId,
      period,
    );
  }
}
