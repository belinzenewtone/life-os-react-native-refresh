import { useCallback, useEffect, useState } from 'react';

import { SyncRepository, type SyncStatusSnapshot } from '@/core/repositories/sync-repository';

const defaultStatus: SyncStatusSnapshot = {
  queued: 0,
  failed: 0,
  syncing: 0,
  runtime: {
    consecutive_failures: 0,
    circuit_open_until: null,
  },
};

export function useSyncStatus(userId: string | null) {
  const [status, setStatus] = useState<SyncStatusSnapshot>(defaultStatus);

  const reload = useCallback(async () => {
    if (!userId) return;
    setStatus(await SyncRepository.getStatus(userId));
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!userId) return;
    const timer = setInterval(() => {
      void reload();
    }, 8000);
    return () => clearInterval(timer);
  }, [reload, userId]);

  return { status, reload };
}
