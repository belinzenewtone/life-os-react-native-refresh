import { getDatabase } from '@/core/data/database/client';

export type CategorySpend = {
  category: string;
  total: number;
};

export type DailySpend = {
  day: string;
  total: number;
};

export class AnalyticsRepository {
  static async categorySpend(userId: string, limit = 8): Promise<CategorySpend[]> {
    const db = await getDatabase();
    return db.getAllAsync<CategorySpend>(
      `SELECT category, SUM(amount) as total
       FROM transactions
       WHERE user_id = ?
       GROUP BY category
       ORDER BY total DESC
       LIMIT ?`,
      userId,
      limit,
    );
  }

  static async dailySpend(userId: string, limit = 14): Promise<DailySpend[]> {
    const db = await getDatabase();
    return db.getAllAsync<DailySpend>(
      `SELECT day, total
       FROM DailySpendView
       WHERE user_id = ?
       ORDER BY day DESC
       LIMIT ?`,
      userId,
      limit,
    );
  }

  static async uncategorizedCount(userId: string): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM transactions
       WHERE user_id = ? AND (category = '' OR category IS NULL OR category = 'Other')`,
      userId,
    );
    return row?.count ?? 0;
  }
}

