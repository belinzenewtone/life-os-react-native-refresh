import { getDatabase } from '@/core/data/database/client';

export type PaybillRegistryRecord = {
  id: string;
  paybill_number: string;
  label: string;
  category: string;
};

function nowIso() {
  return new Date().toISOString();
}

function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export class PaybillRegistryRepository {
  private static readonly KNOWN_PAYBILLS: Record<string, { label: string; category: string }> = {
    '888880': { label: 'KPLC Prepaid', category: 'Bills' },
    '888890': { label: 'KPLC Postpaid', category: 'Bills' },
    '220220': { label: 'Safaricom', category: 'Bills' },
    '303030': { label: 'Airtel Money', category: 'Bills' },
    '200200': { label: 'Nairobi Water', category: 'Bills' },
    '410410': { label: 'DSTV', category: 'Bills' },
    '411411': { label: 'GOtv', category: 'Bills' },
    '405405': { label: 'StarTimes', category: 'Bills' },
    '737373': { label: 'KRA', category: 'Bills' },
    '300300': { label: 'Zuku', category: 'Bills' },
    '542542': { label: 'NHIF', category: 'Health' },
    '909088': { label: 'Jumia', category: 'Shopping' },
    '897998': { label: 'Kenya Power', category: 'Bills' },
  };
  static async list(userId: string): Promise<PaybillRegistryRecord[]> {
    const db = await getDatabase();
    return db.getAllAsync<PaybillRegistryRecord>(
      'SELECT id,paybill_number,label,category FROM paybill_registry WHERE user_id = ? ORDER BY label ASC',
      userId,
    );
  }

  static async lookup(
    userId: string,
    paybillNumber: string,
  ): Promise<PaybillRegistryRecord | null> {
    // Check known static registry first
    const known = this.KNOWN_PAYBILLS[paybillNumber];
    if (known) {
      return { id: `known_${paybillNumber}`, paybill_number: paybillNumber, label: known.label, category: known.category };
    }
    const db = await getDatabase();
    const row = await db.getFirstAsync<PaybillRegistryRecord>(
      'SELECT id,paybill_number,label,category FROM paybill_registry WHERE user_id = ? AND paybill_number = ? LIMIT 1',
      userId,
      paybillNumber,
    );
    return row ?? null;
  }

  /** Upsert by (user_id, paybill_number). */
  static async upsert(
    userId: string,
    paybillNumber: string,
    label: string,
    category: string,
  ): Promise<void> {
    const db = await getDatabase();
    const ts = nowIso();
    const existing = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM paybill_registry WHERE user_id = ? AND paybill_number = ? LIMIT 1',
      userId,
      paybillNumber,
    );
    if (existing) {
      await db.runAsync(
        'UPDATE paybill_registry SET label = ?, category = ?, updated_at = ? WHERE user_id = ? AND id = ?',
        label,
        category,
        ts,
        userId,
        existing.id,
      );
      return;
    }
    await db.runAsync(
      `INSERT INTO paybill_registry (user_id,id,paybill_number,label,category,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?)`,
      userId,
      genId('paybill'),
      paybillNumber,
      label,
      category,
      ts,
      ts,
    );
  }

  /**
   * Auto-learns a paybill→category mapping from a user correction.
   * Extracts the paybill number from the raw SMS if not provided.
   */
  static async learnFromCorrection(
    userId: string,
    rawSms: string,
    correctedCategory: string,
    paybillNumber?: string,
  ): Promise<void> {
    const number = paybillNumber ?? this.extractPaybillNumber(rawSms);
    if (!number) return;

    const label = this.inferLabelFromCategory(correctedCategory);
    await this.upsert(userId, number, label, correctedCategory);
  }

  private static extractPaybillNumber(rawSms: string): string | null {
    const match = rawSms.match(/(?<=\b(PAYBILL|ACCOUNT|TO|ACC|BUY GOODS)\s)\d{5,10}(?=\s|$)/i);
    if (!match) return null;
    const candidate = match[0];
    if (!candidate) return null;
    if (/^(?:0[17]|254[17])\d+$/.test(candidate)) return null;
    return candidate;
  }

  private static inferLabelFromCategory(category: string): string {
    const labels: Record<string, string> = {
      'Bills': 'Utility Payment',
      'Subscriptions': 'Subscription Service',
      'Insurance': 'Insurance Provider',
      'Education': 'School/Fees',
      'Health': 'Medical Provider',
    };
    return labels[category] ?? 'Paybill Service';
  }
}
