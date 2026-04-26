import { useCallback, useEffect, useState } from 'react';
import { InsightCardRepository, type InsightCardRecord } from '@/core/repositories/insight-card-repository';
import { buildWeeklySpendData, buildMonthlySpendData, generateDeterministicInsights } from '@/core/domain/usecases/insight-engine';

export function useInsightData(userId: string | null) {
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [weeklyChartData, setWeeklyChartData] = useState<{ label: string; categoryAmounts: Record<string, number> }[]>([]);
  const [weeklyTopCategories, setWeeklyTopCategories] = useState<string[]>([]);
  const [monthlySpendData, setMonthlySpendData] = useState<{ label: string; totalSpend: number; previousTotal: number }[]>([]);
  const [cards, setCards] = useState<InsightCardRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadCards = useCallback(async () => {
    if (!userId) return;
    setCards(await InsightCardRepository.listActive(userId));
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setIsRefreshing(true);
    setError(null);
    try {
      const [weekly, monthly] = await Promise.all([
        buildWeeklySpendData(userId),
        buildMonthlySpendData(userId),
      ]);
      setWeeklyChartData(weekly.chartData);
      setWeeklyTopCategories(weekly.topCategories);
      setMonthlySpendData(monthly);

      // Generate deterministic insights and persist
      await generateDeterministicInsights(userId);
      await loadCards();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to refresh insights');
    } finally {
      setIsRefreshing(false);
    }
  }, [userId, loadCards]);

  useEffect(() => {
    setIsLoading(true);
    refresh().finally(() => setIsLoading(false));
  }, [refresh]);

  return { isLoading, isRefreshing, weeklyChartData, weeklyTopCategories, monthlySpendData, cards, error, refresh, loadCards };
}
