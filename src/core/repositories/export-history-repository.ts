import { getDatabase } from '@/core/data/database/client';

export type ExportHistoryRecord = {
  id: string;
  filename: string;
  record_count: number;
  created_at: string;
};

function nowIso() {
  return new Date().toISOString();
}

function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export class ExportHistoryRepository {
  static async record(userId: string, filename: string, recordCount: number): Promise<string> {
    const db = await getDatabase();
    const id = genId('export');
    const created = nowIso();
    await db.runAsync(
      'INSERT INTO export_history (user_id,id,filename,record_count,created_at) VALUES (?,?,?,?,?)',
      userId,
      id,
      filename,
      recordCount,
      created,
    );
    return id;
  }

  static async list(userId: string): Promise<ExportHistoryRecord[]> {
    const db = await getDatabase();
    return db.getAllAsync<ExportHistoryRecord>(
      'SELECT id,filename,record_count,created_at FROM export_history WHERE user_id = ? ORDER BY created_at DESC',
      userId,
    );
  }
}
