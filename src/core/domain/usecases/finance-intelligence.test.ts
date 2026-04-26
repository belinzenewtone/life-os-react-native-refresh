import { describe, expect, it } from 'vitest';

import {
  buildFeeAnalytics,
  buildLearningRecommendations,
  buildLoanMetrics,
  buildTaskCompletionMetrics,
  buildWeeklyReviewSnapshot,
} from './finance-intelligence';

describe('finance intelligence usecases', () => {
  it('computes task completion metrics and weekly review signal', () => {
    const taskCompletion = buildTaskCompletionMetrics([
      { status: 'COMPLETED' },
      { status: 'PENDING' },
      { status: 'IN_PROGRESS' },
    ]);
    expect(taskCompletion).toEqual({
      completed: 1,
      pending: 2,
      total: 3,
      completionRate: 1 / 3,
    });

    const review = buildWeeklyReviewSnapshot({
      tasks: [
        { status: 'COMPLETED', deadline: null, completed_at: null },
        { status: 'PENDING', deadline: null, completed_at: null },
      ],
      spending: { today: 500, week: 4000, month: 7000 },
    });
    expect(review.weekOnWeekSignal).toBe('AT_RISK');
    expect(review.summary.tasksPending).toBe(1);
  });

  it('derives loan exposure and available limit from transactions', () => {
    const metrics = buildLoanMetrics([
      { id: '1', merchant: 'Fuliza', amount: 1200, transaction_type: 'LOAN', date: 1000 },
      { id: '2', merchant: 'Fuliza', amount: 150, transaction_type: 'FULIZA_FEE', date: 2000 },
      { id: '3', merchant: 'M-Pesa', amount: 300, transaction_type: 'FULIZA_REPAYMENT', date: 3000 },
    ]);

    expect(metrics.borrowedTotal).toBe(1200);
    expect(metrics.feeTotal).toBe(150);
    expect(metrics.repaidTotal).toBe(300);
    expect(metrics.outstanding).toBe(1050);
    expect(metrics.estimatedAvailable).toBe(3950);
    expect(metrics.events[0]?.kind).toBe('REPAYMENT');
  });

  it('estimates fee analytics and top fee merchants', () => {
    const fee = buildFeeAnalytics([
      { merchant: 'KPLC', amount: 2000, transaction_type: 'PAYBILL' },
      { merchant: 'Naivas', amount: 1000, transaction_type: 'BUY_GOODS' },
      { merchant: 'Salary', amount: 50000, transaction_type: 'RECEIVED' },
    ]);

    expect(fee.serviceCharge).toBe(42);
    expect(fee.billedSmsCount).toBe(3);
    expect(fee.smsCharge).toBe(2.4);
    expect(fee.total).toBe(44.4);
    expect(fee.topMerchants[0]?.merchant).toBe('KPLC');
  });

  it('builds adaptive learning recommendations from system metrics', () => {
    const lessons = buildLearningRecommendations({
      taskCompletion: { completed: 2, pending: 4, total: 6, completionRate: 0.33 },
      uncategorizedCount: 3,
      feeAnalytics: { serviceCharge: 100, smsCharge: 30, total: 130, billedSmsCount: 25, topMerchants: [] },
      loanMetrics: {
        outstanding: 400,
        estimatedAvailable: 4600,
        borrowedTotal: 800,
        repaidTotal: 400,
        feeTotal: 0,
        events: [],
      },
    });

    expect(lessons).toHaveLength(4);
    expect(lessons[0]?.tone).toBe('WARNING');
  });
});
