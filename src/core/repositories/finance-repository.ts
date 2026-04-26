import { getDatabase } from '@/core/data/database/client';
import { MerchantCategoryRepository } from '@/core/repositories/merchant-category-repository';

export type FinanceSummary = {
  today: number;
  week: number;
  month: number;
};

export type RecentTransaction = {
  id: string;
  merchant: string;
  category: string;
  amount: number;
  transaction_type: string;
  date: number;
  transaction_cost: number | null;
};

export type UncategorizedTransaction = {
  id: string;
  merchant: string;
  amount: number;
  date: number;
  category: string;
};

export type MerchantTransaction = {
  id: string;
  merchant: string;
  amount: number;
  category: string;
  date: number;
  transaction_type: string;
};

export type CategoryMonthlySpend = {
  category: string;
  total: number;
};

function startOfDay(now: Date) {
  const value = new Date(now);
  value.setHours(0, 0, 0, 0);
  return value.getTime();
}

function startOfWeek(now: Date) {
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const value = new Date(now);
  value.setDate(now.getDate() + diff);
  value.setHours(0, 0, 0, 0);
  return value.getTime();
}

function startOfMonth(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

const incomingTransactionTypes = ['RECEIVED', 'DEPOSIT'];

function outgoingSpendPredicate() {
  return `amount > 0 AND transaction_type NOT IN (${incomingTransactionTypes.map(() => '?').join(',')})`;
}

export class FinanceRepository {
  static async getSummary(userId: string): Promise<FinanceSummary> {
    const db = await getDatabase();
    const now = new Date();
    const outgoingPredicate = outgoingSpendPredicate();
    const [today, week, month] = await Promise.all([
      db.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM transactions
         WHERE user_id = ? AND date >= ? AND ${outgoingPredicate}`,
        userId,
        startOfDay(now),
        ...incomingTransactionTypes,
      ),
      db.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM transactions
         WHERE user_id = ? AND date >= ? AND ${outgoingPredicate}`,
        userId,
        startOfWeek(now),
        ...incomingTransactionTypes,
      ),
      db.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM transactions
         WHERE user_id = ? AND date >= ? AND ${outgoingPredicate}`,
        userId,
        startOfMonth(now),
        ...incomingTransactionTypes,
      ),
    ]);

    return {
      today: today?.total ?? 0,
      week: week?.total ?? 0,
      month: month?.total ?? 0,
    };
  }

  static async getMonthlySpendByCategory(userId: string, monthKey?: string): Promise<CategoryMonthlySpend[]> {
    const db = await getDatabase();
    const now = new Date();
    const [year, month] = (monthKey ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
      .split('-')
      .map((value) => Number(value));
    const start = new Date(year, Math.max(0, month - 1), 1).getTime();
    const end = new Date(year, Math.max(0, month), 1).getTime();

    return db.getAllAsync<CategoryMonthlySpend>(
      `SELECT category, COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE user_id = ?
         AND date >= ?
         AND date < ?
         AND ${outgoingSpendPredicate()}
       GROUP BY category
       ORDER BY total DESC`,
      userId,
      start,
      end,
      ...incomingTransactionTypes,
    );
  }

  static async listRecent(userId: string): Promise<RecentTransaction[]> {
    const db = await getDatabase();
    return db.getAllAsync<RecentTransaction>(
      'SELECT id,merchant,category,amount,transaction_type,date,transaction_cost FROM transactions WHERE user_id = ? ORDER BY date DESC LIMIT 20',
      userId,
    );
  }

  static async listUncategorized(userId: string): Promise<UncategorizedTransaction[]> {
    const db = await getDatabase();
    return db.getAllAsync<UncategorizedTransaction>(
      `SELECT id,merchant,amount,date,category
       FROM transactions
       WHERE user_id = ? AND (category = '' OR category IS NULL OR category = 'Other')
       ORDER BY date DESC
       LIMIT 100`,
      userId,
    );
  }

  static async updateCategory(userId: string, id: string, category: string) {
    const db = await getDatabase();
    const tx = await db.getFirstAsync<{ merchant: string }>(
      'SELECT merchant FROM transactions WHERE user_id = ? AND id = ?',
      userId,
      id,
    );
    await db.runAsync(
      `UPDATE transactions
       SET category = ?, updated_at = ?, sync_state = ?, record_source = ?
       WHERE user_id = ? AND id = ?`,
      category,
      new Date().toISOString(),
      'QUEUED',
      'LOCAL',
      userId,
      id,
    );
    if (tx?.merchant) {
      await MerchantCategoryRepository.setCategory(userId, tx.merchant, category, true);
    }
  }

  static async listByMerchant(userId: string, merchant: string): Promise<MerchantTransaction[]> {
    const db = await getDatabase();
    return db.getAllAsync<MerchantTransaction>(
      `SELECT id,merchant,amount,category,date,transaction_type
       FROM transactions
       WHERE user_id = ? AND merchant = ?
       ORDER BY date DESC`,
      userId,
      merchant,
    );
  }

  static async findById(userId: string, id: string): Promise<RecentTransaction | null> {
    const db = await getDatabase();
    return db.getFirstAsync<RecentTransaction>(
      'SELECT id,merchant,category,amount,transaction_type,date FROM transactions WHERE user_id = ? AND id = ?',
      userId,
      id,
    );
  }

  static async updateTransaction(
    userId: string,
    id: string,
    patch: { merchant?: string; amount?: number; category?: string; transaction_type?: string; date?: number },
  ) {
    const db = await getDatabase();
    const current = await this.findById(userId, id);
    if (!current) return;
    await db.runAsync(
      `UPDATE transactions SET merchant = ?, amount = ?, category = ?, transaction_type = ?, date = ?, updated_at = ?, sync_state = ?, revision = revision + 1 WHERE user_id = ? AND id = ?`,
      patch.merchant ?? current.merchant,
      patch.amount ?? current.amount,
      patch.category ?? current.category,
      patch.transaction_type ?? current.transaction_type,
      patch.date ?? current.date,
      new Date().toISOString(),
      'QUEUED',
      userId,
      id,
    );
  }

  static async deleteTransaction(userId: string, id: string) {
    const db = await getDatabase();
    const ts = new Date().toISOString();
    await db.runAsync(
      `UPDATE transactions SET deleted_at = ?, updated_at = ?, sync_state = ?, revision = revision + 1 WHERE user_id = ? AND id = ?`,
      ts,
      ts,
      'QUEUED',
      userId,
      id,
    );
  }

  static async createExpense(
    userId: string,
    input: {
      amount: number;
      merchant: string;
      category?: string;
      source?: 'MPESA' | 'Manual' | 'Bank';
      transactionType?: string;
      date?: number;
    },
  ) {
    const db = await getDatabase();
    const id = `tx_manual_${Date.now()}_${Math.round(Math.random() * 10_000)}`;
    const nowIso = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO transactions (
        user_id,id,amount,merchant,category,date,source,transaction_type,
        mpesa_code,source_hash,semantic_hash,raw_sms,inferred_category,inference_source,
        created_at,updated_at,sync_state,record_source,revision,deleted_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      userId,
      id,
      Math.max(0, input.amount),
      input.merchant,
      input.category ?? 'Other',
      input.date ?? Date.now(),
      input.source ?? 'Manual',
      input.transactionType ?? 'PAID',
      null,
      null,
      null,
      null,
      null,
      null,
      nowIso,
      nowIso,
      'QUEUED',
      'LOCAL',
      1,
      null,
    );
    return id;
  }

  static async getTotalSpendingBetween(userId: string, start: number, end: number): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND date >= ? AND date <= ? AND amount > 0 AND transaction_type NOT IN ('RECEIVED','DEPOSIT')`,
      userId, start, end
    );
    return row?.total ?? 0;
}

  static async getFeeCategoryBreakdown(userId: string, start: number, end: number): Promise<{ category: string; total: number }[]> {
    const db = await getDatabase();
    const feeTypes = ['AIRTIME', 'FULIZA_CHARGE', 'WITHDRAWN', 'PAYBILL'];
    return db.getAllAsync(
      `SELECT category, COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE user_id = ? AND date >= ? AND date <= ? AND transaction_type IN (${feeTypes.map(() => '?').join(',')})
       GROUP BY category
       ORDER BY total DESC`,
      userId, start, end, ...feeTypes
    );
  }

  static async getFeeTransactions(userId: string, start: number, end: number): Promise<RecentTransaction[]> {
    const db = await getDatabase();
    const feeTypes = ['AIRTIME', 'FULIZA_CHARGE', 'WITHDRAWN', 'PAYBILL'];
    return db.getAllAsync<RecentTransaction>(
      `SELECT id,merchant,category,amount,transaction_type,date
       FROM transactions
       WHERE user_id = ? AND date >= ? AND date <= ? AND transaction_type IN (${feeTypes.map(() => '?').join(',')})
       ORDER BY date DESC
       LIMIT 20`,
      userId, start, end, ...feeTypes
    );
  }
}
