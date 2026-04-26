import { AppTelemetry } from '@/core/observability/app-telemetry';

type SyncEventType =
  | 'sync_started'
  | 'sync_succeeded'
  | 'sync_failed'
  | 'sync_circuit_opened'
  | 'sync_circuit_closed'
  | 'sync_job_enqueued';

export const SyncTelemetry = {
  trackStarted(trigger: string, jobType: string) {
    AppTelemetry.trackEvent('sync_started', { trigger, job_type: jobType });
  },

  trackSucceeded(jobType: string, durationMs: number) {
    AppTelemetry.trackEvent('sync_succeeded', { job_type: jobType, duration_ms: durationMs });
  },

  trackFailed(jobType: string, errorMessage: string, attemptNumber: number) {
    AppTelemetry.trackEvent('sync_failed', { job_type: jobType, error: errorMessage.slice(0, 200), attempt: attemptNumber });
  },

  trackCircuitOpened(failureCount: number, cooldownMs: number) {
    AppTelemetry.trackEvent('sync_circuit_opened', { failure_count: failureCount, cooldown_ms: cooldownMs });
  },

  trackCircuitClosed() {
    AppTelemetry.trackEvent('sync_circuit_closed', {});
  },

  trackJobEnqueued(trigger: string, jobType: string) {
    AppTelemetry.trackEvent('sync_job_enqueued', { trigger, job_type: jobType });
  },
};