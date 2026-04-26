import { useCallback, useEffect, useState } from 'react';

import { FinanceRepository, type RecentTransaction } from '@/core/repositories/finance-repository';

export function useFinanceSummary(userId: string | null) {
  const [summary, setSummary] = useState({ today: 0, week: 0, month: 0 });
  const [recent, setRecent] = useState<RecentTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const [nextSummary, nextRecent] = await Promise.all([
      FinanceRepository.getSummary(userId),
      FinanceRepository.listRecent(userId),
    ]);
    setSummary(nextSummary);
    setRecent(nextRecent);
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { summary, recent, reload, isLoading };
}
