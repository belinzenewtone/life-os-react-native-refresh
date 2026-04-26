import { useEffect, useState } from 'react';

import { AnalyticsRepository, type CategorySpend, type DailySpend } from '@/core/repositories/analytics-repository';

export function useInsights(userId: string | null) {
  const [categories, setCategories] = useState<CategorySpend[]>([]);
  const [daily, setDaily] = useState<DailySpend[]>([]);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!userId) return;
      const [nextCategories, nextDaily, nextUncategorized] = await Promise.all([
        AnalyticsRepository.categorySpend(userId),
        AnalyticsRepository.dailySpend(userId),
        AnalyticsRepository.uncategorizedCount(userId),
      ]);
      if (!mounted) return;
      setCategories(nextCategories);
      setDaily(nextDaily);
      setUncategorizedCount(nextUncategorized);
    }
    load();
    return () => {
      mounted = false;
    };
  }, [userId]);

  return { categories, daily, uncategorizedCount };
}

