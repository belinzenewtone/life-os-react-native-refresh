import { getDatabase } from '@/core/data/database/client';

export type AppUpdateInfoRecord = {
  version_code: number;
  version_name: string;
  download_url: string;
  checksum_sha256: string;
  required: number;
  release_notes: string;
  fetched_at: string;
};

export type AppUpdateInfoInput = {
  version_code: number;
  version_name: string;
  download_url: string;
  checksum_sha256: string;
  required?: boolean;
  release_notes?: string;
};

function nowIso() {
  return new Date().toISOString();
}

export class AppUpdateInfoRepository {
  static async get(userId: string): Promise<AppUpdateInfoRecord | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<AppUpdateInfoRecord>(
      `SELECT version_code,version_name,download_url,checksum_sha256,required,release_notes,fetched_at
         FROM app_update_info WHERE user_id = ? LIMIT 1`,
      userId,
    );
    return row ?? null;
  }

  /** Upsert the single app_update_info row for this user. */
  static async set(userId: string, info: AppUpdateInfoInput): Promise<void> {
    const db = await getDatabase();
    const fetched = nowIso();
    const required = info.required ? 1 : 0;
    const notes = info.release_notes ?? '';
    const existing = await db.getFirstAsync<{ user_id: string }>(
      'SELECT user_id FROM app_update_info WHERE user_id = ? LIMIT 1',
      userId,
    );
    if (existing) {
      await db.runAsync(
        `UPDATE app_update_info
           SET version_code = ?, version_name = ?, download_url = ?, checksum_sha256 = ?,
               required = ?, release_notes = ?, fetched_at = ?
           WHERE user_id = ?`,
        info.version_code,
        info.version_name,
        info.download_url,
        info.checksum_sha256,
        required,
        notes,
        fetched,
        userId,
      );
      return;
    }
    await db.runAsync(
      `INSERT INTO app_update_info
         (user_id,version_code,version_name,download_url,checksum_sha256,required,release_notes,fetched_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      userId,
      info.version_code,
      info.version_name,
      info.download_url,
      info.checksum_sha256,
      required,
      notes,
      fetched,
    );
  }
}
