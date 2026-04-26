import { describe, expect, it } from 'vitest';

import { budgetGuardrail, projectMonthSpend } from './finance-usecases';

describe('finance usecases', () => {
  it('projects month spend from month-to-date pace', () => {
    const projection = projectMonthSpend({
      monthToDateSpend: 12000,
      elapsedDays: 12,
      daysInMonth: 30,
    });

    expect(projection.averagePerDay).toBe(1000);
    expect(projection.projectedMonthSpend).toBe(30000);
  });

  it('returns near-limit status when usage is above 85%', () => {
    const guardrail = budgetGuardrail({ spent: 170, limit: 200 });
    expect(guardrail.status).toBe('NEAR_LIMIT');
    expect(guardrail.remaining).toBe(30);
  });

  it('returns exceeded status when spent is over limit', () => {
    const guardrail = budgetGuardrail({ spent: 250, limit: 200 });
    expect(guardrail.status).toBe('EXCEEDED');
    expect(guardrail.remaining).toBe(-50);
  });
});
