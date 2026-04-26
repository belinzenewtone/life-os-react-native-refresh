import type { SyncState } from '@/core/sync/sync-types';
import { SyncRepository, type SyncTrigger } from '@/core/repositories/sync-repository';
import { NetworkMonitor } from '@/core/sync/network-monitor';
import { SyncService } from '@/core/sync/sync-service';
import { SyncTelemetry } from '@/core/sync/sync-telemetry';

export class SyncCoordinator {
  private static baseCooldownMs = 5 * 60_000;

  private static getRetryBackoffMs(attempt: number) {
    const raw = Math.pow(2, attempt) * 1000;
    const jitter = Math.floor(Math.random() * 900);
    return Math.min(raw, 15 * 60_000) + jitter;
  }

  static async enqueueDefault(
    userId: string,
    trigger: SyncTrigger,
    jobs: ('PUSH_ALL' | 'PULL_ALL' | 'REPAIR_ALL')[] = ['PUSH_ALL', 'PULL_ALL'],
  ) {
    for (const jobType of jobs) {
      await SyncRepository.enqueue(userId, { jobType, trigger });
      SyncTelemetry.trackJobEnqueued(trigger, jobType);
    }
  }

  static async runPending(userId: string) {
    const runtime = await SyncRepository.getRuntime(userId);
    if (runtime.circuit_open_until && new Date(runtime.circuit_open_until).getTime() > Date.now()) {
      return { skipped: true, reason: 'circuit_open' };
    }

    // Skip sync entirely when offline — don't count as failure
    if (!NetworkMonitor.isOnline()) {
      return { skipped: true, reason: 'offline' };
    }

    const jobs = await SyncRepository.listDueJobs(userId);
    if (!jobs.length) return { skipped: true, reason: 'empty' };
    let currentFailures = runtime.consecutive_failures;

    for (const job of jobs) {
      const startTime = Date.now();
      SyncTelemetry.trackStarted(job.trigger, job.job_type);
      await SyncRepository.markSyncing(userId, job.id);
      try {
        if (job.job_type === 'PUSH_ALL') {
          await SyncService.pushAll(userId);
        } else if (job.job_type === 'PULL_ALL') {
          await SyncService.pullAll(userId);
        } else {
          await SyncService.repairAll(userId);
        }
        await SyncRepository.markSynced(userId, job.id);
        currentFailures = 0;
        SyncTelemetry.trackSucceeded(job.job_type, Date.now() - startTime);
        await SyncRepository.setRuntime(userId, { consecutive_failures: 0, circuit_open_until: null });
      } catch (error) {
        const errStr = String(error);
        const isOfflineError = (error as Error & { isOffline?: boolean }).isOffline === true;

        if (isOfflineError) {
          // Offline errors don't count toward circuit breaker
          await SyncRepository.markFailed(userId, job.id, errStr, 30_000); // Retry in 30s
          SyncTelemetry.trackFailed(job.job_type, 'offline', job.attempts + 1);
          break; // Stop processing more jobs while offline
        }

        const nextFailures = currentFailures + 1;
        currentFailures = nextFailures;
        const retryAfterMs = this.getRetryBackoffMs(job.attempts + 1);
        await SyncRepository.markFailed(userId, job.id, errStr, retryAfterMs);
        SyncTelemetry.trackFailed(job.job_type, errStr, job.attempts + 1);

        const shouldOpenCircuit = nextFailures >= 3;
        const cooldown = this.baseCooldownMs * Math.pow(2, Math.min(nextFailures, 3));
        if (shouldOpenCircuit) {
          SyncTelemetry.trackCircuitOpened(nextFailures, cooldown);
        }
        await SyncRepository.setRuntime(userId, {
          consecutive_failures: nextFailures,
          circuit_open_until: shouldOpenCircuit ? new Date(Date.now() + cooldown).toISOString() : null,
        });
      }
    }

    // Refresh insights after successful sync (fire-and-forget, non-blocking)
    if (userId && currentFailures === 0) {
      import('@/core/domain/usecases/refresh-insights-for-user')
        .then((m) => m.refreshInsightsForUser(userId))
        .catch(() => {
          // Insights are best-effort; don't fail sync for insight errors
        });
    }

    return { skipped: false, processed: jobs.length };
  }

  mapStateToPill(state: SyncState) {
    return state;
  }
}