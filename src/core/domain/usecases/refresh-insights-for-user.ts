import { getDatabase } from '@/core/data/database/client';
import { FinanceRepository } from '@/core/repositories/finance-repository';
import { FulizaRepository } from '@/core/repositories/fuliza-repository';
import { refreshDeterministicInsights, type InsightInput } from '@/core/domain/usecases/deterministic-insights';

export async function refreshInsightsForUser(userId: string): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

  const [summary, budgets, tx7d, uncategorized, lastSync] = await Promise.all([
    FinanceRepository.getSummary(userId),
    db.getAllAsync<{ category: string; limit_amount: number }>(
      'SELECT category, limit_amount FROM budgets WHERE user_id = ? AND deleted_at IS NULL',
      userId,
    ),
    db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND date >= ? AND deleted_at IS NULL',
      userId,
      weekAgo,
    ),
    db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM transactions
       WHERE user_id = ? AND (category = '' OR category IS NULL OR category = 'Other') AND deleted_at IS NULL`,
      userId,
    ),
    db.getFirstAsync<{ updated_at: string }>(
      'SELECT updated_at FROM sync_jobs WHERE user_id = ? AND status = ? ORDER BY updated_at DESC LIMIT 1',
      userId,
      'SYNCED',
    ),
  ]);

  const budgetLimits = await Promise.all(
    budgets.map(async (b: { category: string; limit_amount: number }) => {
      const spent = await db.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
         WHERE user_id = ? AND category = ? AND date >= ? AND amount > 0 AND transaction_type NOT IN ('RECEIVED','DEPOSIT') AND deleted_at IS NULL`,
        userId,
        b.category,
        monthAgo,
      );
      return { category: b.category, limitAmount: b.limit_amount, spentAmount: spent?.total ?? 0 };
    }),
  );

  const topMerchantRow = await db.getFirstAsync<{ merchant: string; count: number }>(
    `SELECT merchant, COUNT(*) as count FROM transactions
     WHERE user_id = ? AND date >= ? AND deleted_at IS NULL
     GROUP BY merchant ORDER BY count DESC LIMIT 1`,
    userId,
    weekAgo,
  );

  const topCategoryRow = await db.getFirstAsync<{ category: string; total: number }>(
    `SELECT category, SUM(amount) as total FROM transactions
     WHERE user_id = ? AND date >= ? AND amount > 0 AND transaction_type NOT IN ('RECEIVED','DEPOSIT') AND deleted_at IS NULL
     GROUP BY category ORDER BY total DESC LIMIT 1`,
    userId,
    weekAgo,
  );

  const daysSinceLastSync = lastSync?.updated_at
    ? Math.floor((Date.now() - new Date(lastSync.updated_at).getTime()) / (24 * 60 * 60 * 1000))
    : null;

  const input: InsightInput = {
    userId,
    totalSpendThisWeek: summary.week,
    totalSpendThisMonth: summary.month,
    budgetLimits,
    transactionCount7d: tx7d?.count ?? 0,
    uncategorizedCount: uncategorized?.count ?? 0,
    loanOutstanding: await FulizaRepository.getNetOutstanding(userId),
    daysSinceLastSync,
    topMerchant: topMerchantRow?.merchant ?? null,
    topCategory: topCategoryRow?.category ?? null,
  };

  await refreshDeterministicInsights(userId, input);
}
