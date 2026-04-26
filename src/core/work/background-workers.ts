import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { AuthSessionStore } from '@/core/security/auth-session-store';
import { ImportAuditPruner } from '@/core/platform/sms/import-audit-pruner';
import { SyncCoordinator } from '@/core/sync/sync-coordinator';
import { executeDueRecurringRules } from '@/core/work/recurring-executor';

const SYNC_TASK = 'lifeos.sync.periodic';

if (!TaskManager.isTaskDefined(SYNC_TASK)) {
  TaskManager.defineTask(SYNC_TASK, async () => {
    try {
      const session = await AuthSessionStore.read();
      if (!session.userId) return BackgroundTask.BackgroundTaskResult.Success;

      await executeDueRecurringRules(session.userId);
      await SyncCoordinator.enqueueDefault(session.userId, 'PERIODIC_WORK', ['PUSH_ALL', 'PULL_ALL']);
      await SyncCoordinator.runPending(session.userId);

      // Prune old import audit records (best-effort, non-blocking)
      try {
        await ImportAuditPruner.prune(session.userId);
      } catch {
        // Pruning is housekeeping — don't fail the whole task
      }

      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export async function registerBackgroundWorkers() {
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;

  const isRegistered = await TaskManager.isTaskRegisteredAsync(SYNC_TASK);
  if (!isRegistered) {
    await BackgroundTask.registerTaskAsync(SYNC_TASK, {
      minimumInterval: 60,
    });
  }
}

export async function unregisterBackgroundWorkers() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(SYNC_TASK);
  if (isRegistered) {
    await BackgroundTask.unregisterTaskAsync(SYNC_TASK);
  }
}