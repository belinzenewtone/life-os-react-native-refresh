import { getDatabase } from '@/core/data/database/client';

export type SyncTrigger = 'APP_START' | 'PERIODIC_WORK' | 'USER_PULL_TO_REFRESH' | 'USER_MANUAL_RETRY' | 'NETWORK_RESTORED';
export type SyncJobStatus = 'QUEUED' | 'SYNCING' | 'SYNCED' | 'FAILED';

export type SyncJobRecord = {
  user_id: string;
  id: string;
  job_type: 'PUSH_ALL' | 'PULL_ALL' | 'REPAIR_ALL';
  trigger: SyncTrigger;
  status: SyncJobStatus;
  attempts: number;
  payload: string | null;
  last_error: string | null;
  queued_at: string;
  run_after: string;
  updated_at: string;
};

type RuntimeState = {
  consecutive_failures: number;
  circuit_open_until: string | null;
};

export type SyncStatusSnapshot = {
  queued: number;
  failed: number;
  syncing: number;
  runtime: RuntimeState;
};

function nowIso() {
  return new Date().toISOString();
}

export class SyncRepository {
  static async enqueue(
    userId: string,
    input: {
      jobType: SyncJobRecord['job_type'];
      trigger: SyncTrigger;
      payload?: unknown;
      runAfterMs?: number;
    },
  ) {
    const db = await getDatabase();

    // Deduplication: if an active job with the same type already exists,
    // update its trigger and return the existing id instead of creating a duplicate.
    const existing = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM sync_jobs
       WHERE user_id = ? AND job_type = ? AND status IN ('QUEUED','SYNCING')
       ORDER BY queued_at DESC LIMIT 1`,
      userId,
      input.jobType,
    );

    if (existing) {
      await db.runAsync(
        `UPDATE sync_jobs SET trigger = ?, updated_at = ? WHERE user_id = ? AND id = ?`,
        input.trigger,
        nowIso(),
        userId,
        existing.id,
      );
      return existing.id;
    }

    const id = `sync_${Date.now()}_${Math.round(Math.random() * 10_000)}`;
    const now = nowIso();
    const runAfter = new Date(Date.now() + (input.runAfterMs ?? 0)).toISOString();
    await db.runAsync(
      `INSERT INTO sync_jobs (
        user_id,id,job_type,trigger,status,attempts,payload,last_error,queued_at,run_after,updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      userId,
      id,
      input.jobType,
      input.trigger,
      'QUEUED',
      0,
      input.payload ? JSON.stringify(input.payload) : null,
      null,
      now,
      runAfter,
      now,
    );
    return id;
  }

  static async listDueJobs(userId: string, limit = 10): Promise<SyncJobRecord[]> {
    const db = await getDatabase();
    return db.getAllAsync<SyncJobRecord>(
      `SELECT user_id,id,job_type,trigger,status,attempts,payload,last_error,queued_at,run_after,updated_at
       FROM sync_jobs
       WHERE user_id = ? AND status IN ('QUEUED','FAILED') AND run_after <= ?
       ORDER BY queued_at ASC
       LIMIT ?`,
      userId,
      nowIso(),
      limit,
    );
  }

  static async markSyncing(userId: string, id: string) {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE sync_jobs SET status = ?, attempts = attempts + 1, updated_at = ? WHERE user_id = ? AND id = ?',
      'SYNCING',
      nowIso(),
      userId,
      id,
    );
  }

  static async markSynced(userId: string, id: string) {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE sync_jobs SET status = ?, updated_at = ?, last_error = NULL WHERE user_id = ? AND id = ?',
      'SYNCED',
      nowIso(),
      userId,
      id,
    );
  }

  static async markFailed(userId: string, id: string, error: string, retryAfterMs: number) {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE sync_jobs SET status = ?, last_error = ?, run_after = ?, updated_at = ? WHERE user_id = ? AND id = ?',
      'FAILED',
      error,
      new Date(Date.now() + retryAfterMs).toISOString(),
      nowIso(),
      userId,
      id,
    );
  }

  static async getRuntime(userId: string): Promise<RuntimeState> {
    const db = await getDatabase();
    const runtime = await db.getFirstAsync<RuntimeState>(
      'SELECT consecutive_failures,circuit_open_until FROM sync_runtime WHERE user_id = ?',
      userId,
    );
    if (runtime) return runtime;
    await db.runAsync(
      'INSERT INTO sync_runtime (user_id,consecutive_failures,circuit_open_until,updated_at) VALUES (?,?,?,?)',
      userId,
      0,
      null,
      nowIso(),
    );
    return { consecutive_failures: 0, circuit_open_until: null };
  }

  static async setRuntime(userId: string, state: RuntimeState) {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO sync_runtime (user_id,consecutive_failures,circuit_open_until,updated_at)
       VALUES (?,?,?,?)
       ON CONFLICT(user_id) DO UPDATE SET consecutive_failures=excluded.consecutive_failures,circuit_open_until=excluded.circuit_open_until,updated_at=excluded.updated_at`,
      userId,
      state.consecutive_failures,
      state.circuit_open_until,
      nowIso(),
    );
  }

  static async getStatus(userId: string): Promise<SyncStatusSnapshot> {
    const db = await getDatabase();
    const [queued, failed, syncing, runtime] = await Promise.all([
      db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM sync_jobs WHERE user_id = ? AND status = ?', userId, 'QUEUED'),
      db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM sync_jobs WHERE user_id = ? AND status = ?', userId, 'FAILED'),
      db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM sync_jobs WHERE user_id = ? AND status = ?', userId, 'SYNCING'),
      this.getRuntime(userId),
    ]);

    return {
      queued: queued?.count ?? 0,
      failed: failed?.count ?? 0,
      syncing: syncing?.count ?? 0,
      runtime,
    };
  }
}
