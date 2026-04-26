import { getDatabase } from '@/core/data/database/client';

export type MerchantCategoryRecord = {
  id: string;
  merchant: string;
  category: string;
  user_corrected: number;
};

function nowIso() {
  return new Date().toISOString();
}

function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export class MerchantCategoryRepository {
  static async list(userId: string): Promise<MerchantCategoryRecord[]> {
    const db = await getDatabase();
    return db.getAllAsync<MerchantCategoryRecord>(
      'SELECT id,merchant,category,user_corrected FROM merchant_categories WHERE user_id = ? AND deleted_at IS NULL ORDER BY merchant ASC',
      userId,
    );
  }

  static async findByMerchant(
    userId: string,
    merchant: string,
  ): Promise<MerchantCategoryRecord | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<MerchantCategoryRecord>(
      'SELECT id,merchant,category,user_corrected FROM merchant_categories WHERE user_id = ? AND merchant = ? AND deleted_at IS NULL LIMIT 1',
      userId,
      merchant,
    );
    return row ?? null;
  }

  static async setCategory(userId: string, merchant: string, category: string, userCorrected = true): Promise<void> {
    const db = await getDatabase();
    const ts = nowIso();
    const existing = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM merchant_categories WHERE user_id = ? AND merchant = ? LIMIT 1',
      userId,
      merchant,
    );
    if (existing) {
      await db.runAsync(
        `UPDATE merchant_categories
           SET category = ?, user_corrected = ?, deleted_at = NULL, updated_at = ?, sync_state = ?, revision = revision + 1
           WHERE user_id = ? AND id = ?`,
        category,
        userCorrected ? 1 : 0,
        ts,
        'QUEUED',
        userId,
        existing.id,
      );
      return;
    }
    const id = genId('mcat');
    await db.runAsync(
      `INSERT INTO merchant_categories
         (user_id,id,merchant,category,user_corrected,created_at,updated_at,sync_state,record_source,revision,deleted_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      userId,
      id,
      merchant,
      category,
      userCorrected ? 1 : 0,
      ts,
      ts,
      'QUEUED',
      'LOCAL',
      1,
      null,
    );
  }

  static async remove(userId: string, merchant: string): Promise<void> {
    const db = await getDatabase();
    const ts = nowIso();
    await db.runAsync(
      `UPDATE merchant_categories
         SET deleted_at = ?, updated_at = ?, sync_state = ?, revision = revision + 1
         WHERE user_id = ? AND merchant = ?`,
      ts,
      ts,
      'QUEUED',
      userId,
      merchant,
    );
  }
}