export type SyncState = 'LOCAL_ONLY' | 'QUEUED' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'CONFLICT' | 'TOMBSTONED';

export type CanonicalSyncMeta = {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  sync_state: SyncState;
  record_source: string;
  revision: number;
  deleted_at: string | null;
};