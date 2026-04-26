import { afterEach, describe, expect, it, vi } from 'vitest';
/* eslint-disable import/first */

vi.mock('../repositories/sync-repository', () => ({
  SyncRepository: {
    enqueue: vi.fn(),
    getRuntime: vi.fn(),
    listDueJobs: vi.fn(),
    markSyncing: vi.fn(),
    markSynced: vi.fn(),
    markFailed: vi.fn(),
    setRuntime: vi.fn(),
  },
}));

vi.mock('./sync-service', () => ({
  SyncService: {
    pushAll: vi.fn(),
    pullAll: vi.fn(),
    repairAll: vi.fn(),
  },
}));

vi.mock('./network-monitor', () => ({
  NetworkMonitor: {
    isOnline: () => true,
    assertOnline: () => {},
    getState: () => ({ isConnected: true, isInternetReachable: true, connectionType: 'wifi' }),
  },
}));

import { SyncRepository } from '../repositories/sync-repository';
import { SyncCoordinator } from './sync-coordinator';
import { SyncService } from './sync-service';

function makeJob(
  id: string,
  jobType: 'PUSH_ALL' | 'PULL_ALL' | 'REPAIR_ALL',
  attempts = 0,
) {
  return {
    user_id: 'u1',
    id,
    job_type: jobType,
    trigger: 'APP_START',
    status: 'QUEUED',
    attempts,
    payload: null,
    last_error: null,
    queued_at: new Date().toISOString(),
    run_after: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as const;
}

describe('SyncCoordinator.runPending', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips when circuit breaker is open', async () => {
    (SyncRepository.getRuntime as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      consecutive_failures: 4,
      circuit_open_until: new Date(Date.now() + 60_000).toISOString(),
    });
    const listSpy = SyncRepository.listDueJobs as unknown as ReturnType<typeof vi.fn>;
    listSpy.mockResolvedValue([]);

    const result = await SyncCoordinator.runPending('u1');

    expect(result).toEqual({ skipped: true, reason: 'circuit_open' });
    expect(listSpy).not.toHaveBeenCalled();
  });

  it('processes pending jobs and resets failure runtime on success', async () => {
    (SyncRepository.getRuntime as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      consecutive_failures: 2,
      circuit_open_until: null,
    });
    (SyncRepository.listDueJobs as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeJob('j1', 'PUSH_ALL'),
      makeJob('j2', 'PULL_ALL'),
      makeJob('j3', 'REPAIR_ALL'),
    ]);
    const markSyncing = SyncRepository.markSyncing as unknown as ReturnType<typeof vi.fn>;
    const markSynced = SyncRepository.markSynced as unknown as ReturnType<typeof vi.fn>;
    const setRuntime = SyncRepository.setRuntime as unknown as ReturnType<typeof vi.fn>;
    markSyncing.mockResolvedValue(undefined);
    markSynced.mockResolvedValue(undefined);
    setRuntime.mockResolvedValue(undefined);
    (SyncService.pushAll as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (SyncService.pullAll as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (SyncService.repairAll as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const result = await SyncCoordinator.runPending('u1');

    expect(result).toEqual({ skipped: false, processed: 3 });
    expect(markSyncing).toHaveBeenCalledTimes(3);
    expect(markSynced).toHaveBeenCalledTimes(3);
    expect(setRuntime).toHaveBeenCalledWith('u1', {
      consecutive_failures: 0,
      circuit_open_until: null,
    });
  });

  it('marks failed job and opens circuit after third consecutive failure', async () => {
    (SyncRepository.getRuntime as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      consecutive_failures: 2,
      circuit_open_until: null,
    });
    (SyncRepository.listDueJobs as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([makeJob('j1', 'PUSH_ALL', 0)]);
    (SyncRepository.markSyncing as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const markFailed = SyncRepository.markFailed as unknown as ReturnType<typeof vi.fn>;
    const setRuntime = SyncRepository.setRuntime as unknown as ReturnType<typeof vi.fn>;
    markFailed.mockResolvedValue(undefined);
    setRuntime.mockResolvedValue(undefined);
    (SyncService.pushAll as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'));

    const result = await SyncCoordinator.runPending('u1');

    expect(result).toEqual({ skipped: false, processed: 1 });
    expect(markFailed).toHaveBeenCalledTimes(1);
    const runtimeCall = setRuntime.mock.calls.at(-1);
    expect(runtimeCall).toBeDefined();
    if (!runtimeCall) return;
    expect(runtimeCall[0]).toBe('u1');
    expect(runtimeCall[1].consecutive_failures).toBe(3);
    expect(runtimeCall[1].circuit_open_until).not.toBeNull();
    expect(new Date(runtimeCall[1].circuit_open_until ?? 0).getTime()).toBeGreaterThan(Date.now());
  });
});
