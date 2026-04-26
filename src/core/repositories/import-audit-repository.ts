import { getDatabase } from '@/core/data/database/client';

export type ImportAuditRecord = {
  id: string;
  source: string;
  status: string;
  message: string;
  mpesa_code: string | null;
  amount: number | null;
  amount_band: string | null;
  payload: string | null;
  created_at: string;
};

export class ImportAuditRepository {
  static async add(
    userId: string,
    input: Omit<ImportAuditRecord, 'id' | 'created_at'>,
  ) {
    const db = await getDatabase();
    const id = `audit_${Date.now()}_${Math.round(Math.random() * 10_000)}`;
    const createdAt = new Date().toISOString();
    await db.runAsync(
      'INSERT INTO import_audit (user_id,id,source,status,message,mpesa_code,amount,amount_band,payload,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      userId,
      id,
      input.source,
      input.status,
      input.message,
      input.mpesa_code ?? null,
      input.amount ?? null,
      input.amount_band ?? null,
      input.payload,
      createdAt,
    );
  }

  static async listRecent(userId: string, limit = 30): Promise<ImportAuditRecord[]> {
    const db = await getDatabase();
    return db.getAllAsync<ImportAuditRecord>(
      'SELECT id,source,status,message,mpesa_code,amount,amount_band,payload,created_at FROM import_audit WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      userId,
      limit,
    );
  }
}