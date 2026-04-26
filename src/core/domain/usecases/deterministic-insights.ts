import { getDatabase } from '@/core/data/database/client';
import { InsightCardRepository } from '@/core/repositories/insight-card-repository';
import { SyncRepository } from '@/core/repositories/sync-repository';

export type InsightInput = {
  userId: string;
  totalSpendThisWeek: number;
  totalSpendThisMonth: number;
  budgetLimits: { category: string; limitAmount: number; spentAmount: number }[];
  transactionCount7d: number;
  uncategorizedCount: number;
  loanOutstanding: number;
  daysSinceLastSync: number | null;
  topMerchant: string | null;
  topCategory: string | null;
};

type GeneratedInsight = {
  kind: string;
  title: string;
  body: string;
  priority: number;
  expiresHours: number;
};

const SPENDING_VELOCITY_THRESHOLD = 0.45;
const BUDGET_WARNING_THRESHOLD = 0.8;

export function generateDeterministicInsights(input: InsightInput): GeneratedInsight[] {
  const insights: GeneratedInsight[] = [];
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthProgress = dayOfMonth / daysInMonth;

  // 1. Overdue tasks insight
  if (input.uncategorizedCount > 0) {
    insights.push({
      kind: 'DETERMINISTIC',
      title: `${input.uncategorizedCount} uncategorized transaction${input.uncategorizedCount > 1 ? 's' : ''}`,
      body: 'Assign categories to improve spending insights and budget accuracy.',
      priority: 80,
      expiresHours: 48,
    });
  }

  // 2. Spending velocity insight
  if (input.totalSpendThisMonth > 0) {
    const expectedPace = input.totalSpendThisMonth * monthProgress;
    const overspendRatio = input.totalSpendThisWeek / (input.totalSpendThisMonth / 4);
    if (overspendRatio > SPENDING_VELOCITY_THRESHOLD + 0.3) {
      insights.push({
        kind: 'DETERMINISTIC',
        title: 'Spending accelerated this week',
        body: `Your weekly spend is ${Math.round(overspendRatio * 100)}% of your monthly total. Consider slowing down discretionary spending.`,
        priority: 90,
        expiresHours: 72,
      });
    } else if (overspendRatio < 0.2) {
      insights.push({
        kind: 'DETERMINISTIC',
        title: 'Low spending week',
        body: 'Your spend this week is well below your monthly pace. Good discipline or a quiet week?',
        priority: 40,
        expiresHours: 48,
      });
    }
  }

  // 3. Budget exceeding insight
  for (const budget of input.budgetLimits) {
    const usage = budget.spentAmount / budget.limitAmount;
    if (usage >= 1) {
      insights.push({
        kind: 'DETERMINISTIC',
        title: `${budget.category} budget exceeded`,
        body: `You've spent KES ${budget.spentAmount.toFixed(0)} of your KES ${budget.limitAmount.toFixed(0)} ${budget.category} budget. Consider adjusting your limit or cutting back.`,
        priority: 95,
        expiresHours: 168,
      });
    } else if (usage >= BUDGET_WARNING_THRESHOLD) {
      insights.push({
        kind: 'DETERMINISTIC',
        title: `${budget.category} budget nearly full`,
        body: `You've used ${Math.round(usage * 100)}% of your ${budget.category} budget with ${Math.round((1 - monthProgress) * 100)}% of the month remaining.`,
        priority: 85,
        expiresHours: 72,
      });
    }
  }

  // 4. Top merchant insight
  if (input.topMerchant) {
    insights.push({
      kind: 'DETERMINISTIC',
      title: `Top merchant: ${input.topMerchant}`,
      body: `${input.topMerchant} is your most frequent transaction destination. Consider checking for subscription or auto-payment.`,
      priority: 50,
      expiresHours: 168,
    });
  }

  // 5. Top category insight
  if (input.topCategory) {
    insights.push({
      kind: 'DETERMINISTIC',
      title: `Highest spending category: ${input.topCategory}`,
      body: `Most of your spend goes to ${input.topCategory}. A small reduction here has outsized impact on your budget.`,
      priority: 55,
      expiresHours: 168,
    });
  }

  // 6. Loan outstanding insight
  if (input.loanOutstanding > 0) {
    insights.push({
      kind: 'DETERMINISTIC',
      title: 'Active loan balance',
      body: `You have KES ${input.loanOutstanding.toFixed(0)} outstanding in loans. Prioritize repayment to reduce interest costs.`,
      priority: 70,
      expiresHours: 72,
    });
  }

  // 7. Sync stale insight
  if (input.daysSinceLastSync !== null && input.daysSinceLastSync > 1) {
    insights.push({
      kind: 'DETERMINISTIC',
      title: 'Data may be outdated',
      body: `Your last sync was ${input.daysSinceLastSync} day${input.daysSinceLastSync > 1 ? 's' : ''} ago. Pull to refresh for the latest data.`,
      priority: 60,
      expiresHours: 48,
    });
  }

  // 8. Inactivity insight
  if (input.transactionCount7d === 0) {
    insights.push({
      kind: 'DETERMINISTIC',
      title: 'No recent transactions',
      body: 'No M-Pesa transactions recorded in the past 7 days. If you made transactions, try importing from your SMS inbox.',
      priority: 45,
      expiresHours: 168,
    });
  }

  return insights.sort((a, b) => b.priority - a.priority).slice(0, 8);
}

export async function refreshDeterministicInsights(userId: string, input: InsightInput): Promise<void> {
  const insights = generateDeterministicInsights(input);
  const db = await getDatabase();

  await db.runAsync('DELETE FROM insight_cards WHERE user_id = ? AND kind = ?', userId, 'DETERMINISTIC');

  const now = new Date();
  for (const insight of insights) {
    const expiresAt = new Date(now.getTime() + insight.expiresHours * 60 * 60 * 1000).toISOString();
    await InsightCardRepository.insert(userId, {
      kind: insight.kind,
      title: insight.title,
      body: insight.body,
      priority: insight.priority,
      expires_at: expiresAt,
    });
  }
}