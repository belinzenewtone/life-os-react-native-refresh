import type { FinanceSummary, RecentTransaction } from '@/core/repositories/finance-repository';
import type { TaskRecord } from '@/core/repositories/task-repository';

const loanDrawTypes = new Set(['LOAN', 'FULIZA_CHARGE', 'OVERDRAFT']);
const loanRepaymentTypes = new Set(['LOAN_REPAYMENT', 'FULIZA_REPAYMENT']);
const loanFeeTypes = new Set(['FULIZA_INTEREST', 'FULIZA_FEE']);

const serviceRateByTransactionType: Record<string, number> = {
  PAYBILL: 0.015,
  BUY_GOODS: 0.012,
  WITHDRAW: 0.02,
  FULIZA_CHARGE: 0.01,
  LOAN: 0.01,
};

const smsBilledTypes = new Set(['PAYBILL', 'BUY_GOODS', 'WITHDRAW', 'LOAN', 'FULIZA_CHARGE', 'RECEIVED']);

export type TaskCompletionMetrics = {
  completed: number;
  pending: number;
  total: number;
  completionRate: number;
};

export type WeeklyReviewSnapshot = {
  greeting: string;
  weekLabel: string;
  ritual: { title: string; summary: string } | null;
  summary: {
    totalSpend: number;
    postureLabel: string;
    weekDeltaLabel: string;
    topCategory: string | null;
    tasksCompleted: number;
    tasksPending: number;
  };
  wins: string[];
  risks: string[];
  topInsights: string[];
  weekOnWeekSignal: 'ON_TRACK' | 'WATCH' | 'AT_RISK';
};

export type LoanEvent = {
  id: string;
  merchant: string;
  amount: number;
  date: number;
  transactionType: string;
  kind: 'DRAW' | 'REPAYMENT' | 'FEE';
};

export type LoanMetrics = {
  outstanding: number;
  estimatedAvailable: number;
  borrowedTotal: number;
  repaidTotal: number;
  feeTotal: number;
  events: LoanEvent[];
};

export type FeeByMerchant = {
  merchant: string;
  fee: number;
};

export type FeeAnalytics = {
  serviceCharge: number;
  smsCharge: number;
  total: number;
  billedSmsCount: number;
  topMerchants: FeeByMerchant[];
};

export type LearningRecommendation = {
  title: string;
  body: string;
  tone: 'SUCCESS' | 'WARNING' | 'INFO';
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function buildTaskCompletionMetrics(tasks: Pick<TaskRecord, 'status'>[]): TaskCompletionMetrics {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.status === 'COMPLETED').length;
  const pending = total - completed;
  return {
    completed,
    pending,
    total,
    completionRate: total > 0 ? completed / total : 0,
  };
}

function buildList<T>(fn: () => T[]): T[] {
  return fn();
}

export function buildWeeklyReviewSnapshot(input: {
  tasks: Pick<TaskRecord, 'status' | 'deadline' | 'completed_at'>[];
  spending: FinanceSummary;
  recentTransactions?: Pick<RecentTransaction, 'category' | 'amount' | 'transaction_type'>[];
  insights?: { title: string }[];
}): WeeklyReviewSnapshot {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning — here's your weekly review" : hour < 17 ? 'Good afternoon — weekly digest' : 'Good evening — your week in review';

  const weekEnd = new Date();
  const weekLabel = `Week ending ${weekEnd.toLocaleDateString('default', { month: 'short', day: '2-digit' })}`;

  const taskCompletion = buildTaskCompletionMetrics(input.tasks);
  const completedToday = input.tasks.filter((t) => t.completed_at && t.completed_at >= new Date().setHours(0, 0, 0, 0)).length;

  const spend = input.spending;
  const weekOnWeekSignal =
    spend.week <= spend.month * 0.25 ? 'ON_TRACK' : spend.week <= spend.month * 0.45 ? 'WATCH' : 'AT_RISK';

  const topCategory = input.recentTransactions?.length
    ? [...input.recentTransactions
        .filter((tx) => !['RECEIVED', 'DEPOSIT'].includes(tx.transaction_type))
        .reduce((map, tx) => map.set(tx.category, (map.get(tx.category) ?? 0) + tx.amount), new Map<string, number>())
        .entries()]
        .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    : null;

  const averageDailySpend = spend.month / 30;
  const delta = spend.week - averageDailySpend * 5;
  const posture =
    taskCompletion.pending > 5 || delta > 1500 ? 'Needs attention' : completedToday > 0 && taskCompletion.pending <= 3 ? 'Strong finish' : 'Steady';

  const deltaLabel =
    delta > 0 ? `Up KES ${delta.toFixed(2)} from your recent pace` : delta < 0 ? `Down KES ${Math.abs(delta).toFixed(2)} from your recent pace` : 'Flat week';

  const wins = buildList(() => {
    const list: string[] = [];
    if (completedToday > 0) list.push(`${completedToday} task${completedToday === 1 ? '' : 's'} closed today.`);
    list.push('Your next commitment is already visible on the calendar.');
    if (input.insights?.length) list.push(input.insights[0].title);
    return list.length ? list : ['You kept the week visible. Capture one concrete win before you close it.'];
  });

  const risks = buildList(() => {
    const list: string[] = [];
    if (taskCompletion.pending > 0) list.push(`${taskCompletion.pending} task${taskCompletion.pending === 1 ? '' : 's'} still need closure.`);
    if (delta > 0) list.push('Spending accelerated relative to your recent pace.');
    if (!input.recentTransactions?.length) list.push('No recent finance activity is visible, so the review may be missing context.');
    return list.length ? list : ['No immediate risks stood out. Keep the same operating rhythm next week.'];
  });

  const ritualSummary =
    taskCompletion.pending > 0
      ? 'Pick the one pending task that would make next week easier, then either finish it or reschedule it deliberately.'
      : delta > 0
        ? 'Tag the expense category that jumped this week so the next budget conversation starts with facts.'
        : 'Write down one win, one risk, and one change to protect next week.';

  return {
    greeting,
    weekLabel,
    ritual: { title: 'One thing to do before the week closes', summary: ritualSummary },
    summary: {
      totalSpend: spend.week,
      postureLabel: posture,
      weekDeltaLabel: deltaLabel,
      topCategory,
      tasksCompleted: completedToday,
      tasksPending: taskCompletion.pending,
    },
    wins,
    risks,
    topInsights: (input.insights ?? []).slice(0, 3).map((i) => i.title),
    weekOnWeekSignal,
  };
}

export function buildLoanMetrics(transactions: Pick<RecentTransaction, 'id' | 'merchant' | 'amount' | 'date' | 'transaction_type'>[], limit = 5000): LoanMetrics {
  let borrowedTotal = 0;
  let repaidTotal = 0;
  let feeTotal = 0;

  const events: LoanEvent[] = [];

  for (const tx of transactions) {
    const type = tx.transaction_type;
    const amount = Math.max(0, tx.amount);

    if (loanDrawTypes.has(type)) {
      borrowedTotal += amount;
      events.push({ id: tx.id, merchant: tx.merchant, amount, date: tx.date, transactionType: type, kind: 'DRAW' });
      continue;
    }

    if (loanRepaymentTypes.has(type)) {
      repaidTotal += amount;
      events.push({ id: tx.id, merchant: tx.merchant, amount, date: tx.date, transactionType: type, kind: 'REPAYMENT' });
      continue;
    }

    if (loanFeeTypes.has(type)) {
      feeTotal += amount;
      events.push({ id: tx.id, merchant: tx.merchant, amount, date: tx.date, transactionType: type, kind: 'FEE' });
    }
  }

  const outstanding = Math.max(0, borrowedTotal + feeTotal - repaidTotal);
  const estimatedAvailable = Math.max(0, limit - outstanding);

  return {
    outstanding: round2(outstanding),
    estimatedAvailable: round2(estimatedAvailable),
    borrowedTotal: round2(borrowedTotal),
    repaidTotal: round2(repaidTotal),
    feeTotal: round2(feeTotal),
    events: events.sort((a, b) => b.date - a.date),
  };
}

export function buildFeeAnalytics(transactions: Pick<RecentTransaction, 'merchant' | 'amount' | 'transaction_type'>[]): FeeAnalytics {
  let serviceCharge = 0;
  let billedSmsCount = 0;
  const merchantFees = new Map<string, number>();

  for (const tx of transactions) {
    const amount = Math.max(0, tx.amount);
    const rate = serviceRateByTransactionType[tx.transaction_type] ?? 0;
    const fee = amount * rate;
    if (fee > 0) {
      serviceCharge += fee;
      merchantFees.set(tx.merchant, (merchantFees.get(tx.merchant) ?? 0) + fee);
    }

    if (smsBilledTypes.has(tx.transaction_type)) {
      billedSmsCount += 1;
    }
  }

  const smsCharge = billedSmsCount * 0.8;
  const total = serviceCharge + smsCharge;
  const topMerchants = [...merchantFees.entries()]
    .map(([merchant, fee]) => ({ merchant, fee: round2(fee) }))
    .sort((a, b) => b.fee - a.fee)
    .slice(0, 5);

  return {
    serviceCharge: round2(serviceCharge),
    smsCharge: round2(smsCharge),
    total: round2(total),
    billedSmsCount,
    topMerchants,
  };
}

export function buildLearningRecommendations(input: {
  taskCompletion: TaskCompletionMetrics;
  uncategorizedCount: number;
  feeAnalytics: FeeAnalytics;
  loanMetrics: LoanMetrics;
}): LearningRecommendation[] {
  const lessons: LearningRecommendation[] = [];

  if (input.taskCompletion.total > 0 && input.taskCompletion.completionRate < 0.6) {
    lessons.push({
      tone: 'WARNING',
      title: 'Raise task closure consistency',
      body: `Only ${Math.round(input.taskCompletion.completionRate * 100)}% of tracked tasks are closed. Use reminder stacks on high-impact items this week.`,
    });
  }

  if (input.uncategorizedCount > 0) {
    lessons.push({
      tone: 'INFO',
      title: 'Clear uncategorized queue daily',
      body: `${input.uncategorizedCount} transactions still need category assignment. A quick daily pass improves budget and insight accuracy.`,
    });
  }

  if (input.feeAnalytics.total >= 120) {
    lessons.push({
      tone: 'WARNING',
      title: 'Reduce transaction fee pressure',
      body: `Estimated fees are KES ${input.feeAnalytics.total.toFixed(2)}. Bundle low-value transfers and favor lower-fee rails when possible.`,
    });
  }

  if (input.loanMetrics.outstanding > 0) {
    lessons.push({
      tone: 'INFO',
      title: 'Plan Fuliza/loan unwind',
      body: `Outstanding loan exposure is KES ${input.loanMetrics.outstanding.toFixed(2)}. Schedule a staged repayment plan to recover buffer.`,
    });
  }

  if (!lessons.length) {
    lessons.push({
      tone: 'SUCCESS',
      title: 'Your system hygiene looks strong',
      body: 'Tasks, categories, and finance signals are in a healthy range. Keep your weekly review cadence steady.',
    });
  }

  return lessons.slice(0, 4);
}
