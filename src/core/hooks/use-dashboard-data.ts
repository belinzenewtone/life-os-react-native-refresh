import { useCallback, useEffect, useState } from 'react';

import { buildWeeklyReviewSnapshot } from '@/core/domain/usecases/finance-intelligence';
import { FinanceRepository } from '@/core/repositories/finance-repository';
import { EventRepository } from '@/core/repositories/event-repository';
import { TaskRepository } from '@/core/repositories/task-repository';

export function useDashboardData(userId: string | null) {
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState({ today: 0, week: 0, month: 0 });
  const [tasks, setTasks] = useState<Awaited<ReturnType<typeof TaskRepository.list>>>([]);
  const [nextEvent, setNextEvent] = useState<Awaited<ReturnType<typeof EventRepository.findNearestFuture>>>(null);
  const [ritual, setRitual] = useState<{ title: string; summary: string } | null>(null);

  const reload = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const [nextSummary, nextTasks, nextEventRecord] = await Promise.all([
      FinanceRepository.getSummary(userId),
      TaskRepository.list(userId),
      EventRepository.findNearestFuture(userId),
    ]);
    setSummary(nextSummary);
    setTasks(nextTasks);
    setNextEvent(nextEventRecord);

    const snapshot = buildWeeklyReviewSnapshot({
      tasks: nextTasks,
      spending: nextSummary,
    });
    setRitual(snapshot.ritual);
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { isLoading, summary, tasks, nextEvent, ritual, reload };
}
