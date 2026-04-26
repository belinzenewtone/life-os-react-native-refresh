import { FinanceRepository } from '@/core/repositories/finance-repository';
import { InsightCardRepository } from '@/core/repositories/insight-card-repository';
import { TaskRepository } from '@/core/repositories/task-repository';

export async function buildWeeklySpendData(userId: string) {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const incomeTypes = new Set(['RECEIVED', 'DEPOSIT']);

  const rawWeeks = [4, 3, 2, 1, 0].map((offset) => {
    const end = now - offset * weekMs;
    const start = end - weekMs;
    const label = offset === 0 ? 'This wk' : offset === 1 ? 'Last wk' : `W-${offset}`;
    return { label, start, end };
  });

  const weeksWithTxs = await Promise.all(
    rawWeeks.map(async ({ label, start, end }) => {
      const txs = await FinanceRepository.listRecent(userId); // We'll filter by date client-side since listRecent doesn't filter by date
      const filtered = txs.filter((tx) => tx.date >= start && tx.date <= end && tx.amount > 0 && !incomeTypes.has(tx.transaction_type));
      return { label, txs: filtered };
    }),
  );

  const top3 = [...weeksWithTxs.flatMap((w) => w.txs)
    .reduce((map, tx) => map.set(tx.category, (map.get(tx.category) ?? 0) + tx.amount), new Map<string, number>())
    .entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat);

  const chartData = weeksWithTxs.map(({ label, txs }) => ({
    label,
    categoryAmounts: Object.fromEntries(
      top3.map((cat) => [cat, txs.filter((tx) => tx.category === cat).reduce((sum, tx) => sum + tx.amount, 0)]),
    ),
  }));

  return { chartData, topCategories: top3 };
}

export async function buildMonthlySpendData(userId: string) {
  const windows = [5, 4, 3, 2, 1, 0].map((offset) => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const start = d.getTime();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() - 1;
    const label = d.toLocaleString('default', { month: 'short', year: 'numeric' });
    return { label, start, end };
  });

  const totals = await Promise.all(
    windows.map(async ({ label, start, end }) => {
      const total = await FinanceRepository.getTotalSpendingBetween(userId, start, end);
      return { label, total };
    }),
  );

  return totals.map((item, idx) => ({
    label: item.label,
    totalSpend: item.total,
    previousTotal: idx > 0 ? totals[idx - 1].total : 0,
  }));
}

export async function generateDeterministicInsights(userId: string) {
  // Clear old deterministic insights
  const db = await (await import('@/core/data/database/client')).getDatabase();
  await db.runAsync(`DELETE FROM insight_cards WHERE user_id = ? AND kind = 'DETERMINISTIC'`, userId);

  // Fetch data
  const [tasks, recentTxs] = await Promise.all([
    TaskRepository.list(userId),
    FinanceRepository.listRecent(userId),
  ]);

  const now = Date.now();
  const overdueTasks = tasks.filter((t) => t.deadline && t.deadline < now && t.status !== 'COMPLETED');
  if (overdueTasks.length > 0) {
    await InsightCardRepository.insert(userId, {
      kind: 'DETERMINISTIC',
      title: `${overdueTasks.length} task${overdueTasks.length === 1 ? '' : 's'} overdue`,
      body: 'Close or reschedule overdue tasks to keep momentum.',
      priority: 10,
    });
  }

  const monthSpend = recentTxs
    .filter((tx) => tx.date >= new Date().setDate(1) && tx.amount > 0 && !['RECEIVED', 'DEPOSIT'].includes(tx.transaction_type))
    .reduce((sum, tx) => sum + tx.amount, 0);
  if (monthSpend > 0) {
    await InsightCardRepository.insert(userId, {
      kind: 'DETERMINISTIC',
      title: 'Spending summary',
      body: `Month-to-date outflows are approximately KES ${monthSpend.toFixed(2)}.`,
      priority: 5,
    });
  }
}
