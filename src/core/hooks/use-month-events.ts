import { useCallback, useEffect, useState } from 'react';

import { EventRepository, type EventRecord } from '@/core/repositories/event-repository';
import { SyncCoordinator } from '@/core/sync/sync-coordinator';

export function useMonthEvents(userId: string | null, year: number, month: number) {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setEvents(await EventRepository.listByMonth(userId, year, month));
    setIsLoading(false);
  }, [month, userId, year]);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    events,
    isLoading,
    reload,
    createEvent: async (input: { title: string; date: number; kind?: EventRecord['kind']; type?: EventRecord['type']; end_date?: number | null; all_day?: boolean }) => {
      if (!userId) return;
      await EventRepository.create(userId, input);
      await SyncCoordinator.enqueueDefault(userId, 'USER_MANUAL_RETRY', ['PUSH_ALL']);
      await SyncCoordinator.runPending(userId);
      await reload();
    },
    updateEvent: async (id: string, patch: Parameters<typeof EventRepository.update>[2]) => {
      if (!userId) return;
      await EventRepository.update(userId, id, patch);
      await SyncCoordinator.enqueueDefault(userId, 'USER_MANUAL_RETRY', ['PUSH_ALL']);
      await SyncCoordinator.runPending(userId);
      await reload();
    },
    setEventCompleted: async (id: string, completed: boolean) => {
      if (!userId) return;
      await EventRepository.update(userId, id, { status: completed ? 'COMPLETED' : 'PENDING' });
      await SyncCoordinator.enqueueDefault(userId, 'USER_MANUAL_RETRY', ['PUSH_ALL']);
      await SyncCoordinator.runPending(userId);
      await reload();
    },
    deleteEvent: async (id: string) => {
      if (!userId) return;
      await EventRepository.remove(userId, id);
      await SyncCoordinator.enqueueDefault(userId, 'USER_MANUAL_RETRY', ['PUSH_ALL']);
      await SyncCoordinator.runPending(userId);
      await reload();
    },
  };
}
