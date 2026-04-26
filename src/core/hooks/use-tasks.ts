import { useCallback, useEffect, useState } from 'react';

import { TaskRepository, type TaskRecord } from '@/core/repositories/task-repository';
import { SyncCoordinator } from '@/core/sync/sync-coordinator';

export function useTasks(userId: string | null) {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setTasks(await TaskRepository.list(userId));
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    tasks,
    isLoading,
    reload,
    createTask: async (title: string, deadline?: number | null) => {
      if (!userId) return;
      await TaskRepository.create(userId, { title, deadline });
      await SyncCoordinator.enqueueDefault(userId, 'USER_MANUAL_RETRY', ['PUSH_ALL']);
      await SyncCoordinator.runPending(userId);
      await reload();
    },
    toggleTask: async (id: string) => {
      if (!userId) return;
      await TaskRepository.toggleComplete(userId, id);
      await SyncCoordinator.enqueueDefault(userId, 'USER_MANUAL_RETRY', ['PUSH_ALL']);
      await SyncCoordinator.runPending(userId);
      await reload();
    },
    setTaskCompleted: async (id: string, completed: boolean) => {
      if (!userId) return;
      await TaskRepository.setCompleted(userId, id, completed);
      await SyncCoordinator.enqueueDefault(userId, 'USER_MANUAL_RETRY', ['PUSH_ALL']);
      await SyncCoordinator.runPending(userId);
      await reload();
    },
    updateTask: async (id: string, patch: Parameters<typeof TaskRepository.update>[2]) => {
      if (!userId) return;
      await TaskRepository.update(userId, id, patch);
      await SyncCoordinator.enqueueDefault(userId, 'USER_MANUAL_RETRY', ['PUSH_ALL']);
      await SyncCoordinator.runPending(userId);
      await reload();
    },
    deleteTask: async (id: string) => {
      if (!userId) return;
      await TaskRepository.remove(userId, id);
      await SyncCoordinator.enqueueDefault(userId, 'USER_MANUAL_RETRY', ['PUSH_ALL']);
      await SyncCoordinator.runPending(userId);
      await reload();
    },
  };
}
