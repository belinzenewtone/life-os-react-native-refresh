export function projectMonthSpend(input: {
  monthToDateSpend: number;
  elapsedDays: number;
  daysInMonth: number;
}) {
  const safeElapsed = Math.max(1, input.elapsedDays);
  const safeTotalDays = Math.max(safeElapsed, input.daysInMonth);
  const averagePerDay = input.monthToDateSpend / safeElapsed;
  const projectedMonthSpend = averagePerDay * safeTotalDays;
  return {
    averagePerDay,
    projectedMonthSpend,
  };
}

export function budgetGuardrail(input: { spent: number; limit: number }) {
  if (input.limit <= 0) {
    return {
      ratio: 0,
      remaining: 0,
      status: 'ON_TRACK' as const,
    };
  }

  const ratio = Math.max(0, input.spent / input.limit);
  const remaining = input.limit - input.spent;
  const status = ratio >= 1 ? 'EXCEEDED' : ratio >= 0.85 ? 'NEAR_LIMIT' : 'ON_TRACK';

  return { ratio, remaining, status };
}
