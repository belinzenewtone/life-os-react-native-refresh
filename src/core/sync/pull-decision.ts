import { SyncConflictResolver, type ConflictContext } from './sync-conflict-resolver';

export type PullDecision = 'CONFLICT' | 'TOMBSTONE' | 'UPSERT' | 'SKIP';

export async function determinePullDecision(input: {
  tableName: string;
  recordId: string;
  localUpdatedAt: string | null | undefined;
  localSyncState: string | null | undefined;
  localRevision: number | null | undefined;
  remoteUpdatedAt: string | null | undefined;
  remoteRevision: number | null | undefined;
  remoteDeletedAt: string | null | undefined;
}): Promise<PullDecision> {
  // Fast path: remote deletion always wins (unless local is also pending delete)
  if (input.remoteDeletedAt) return 'TOMBSTONE';

  // Check if this is actually a conflict
  const isConflict = SyncConflictResolver.isConflict({
    localSyncState: input.localSyncState,
    localRevision: input.localRevision,
    localUpdatedAt: input.localUpdatedAt,
    remoteRevision: input.remoteRevision,
    remoteUpdatedAt: input.remoteUpdatedAt,
  });

  if (!isConflict) return 'UPSERT';

  // It's a conflict — run the resolver strategy
  const ctx: ConflictContext = {
    tableName: input.tableName,
    recordId: input.recordId,
    localState: input.localSyncState,
    localRevision: input.localRevision ?? 0,
    localUpdatedAt: input.localUpdatedAt,
    remoteRevision: input.remoteRevision ?? 0,
    remoteUpdatedAt: input.remoteUpdatedAt,
    remoteDeletedAt: input.remoteDeletedAt,
  };

  const resolution = await SyncConflictResolver.resolve(ctx);

  switch (resolution) {
    case 'KEEP_LOCAL':
      return 'SKIP'; // Skip applying remote, keep local pending change
    case 'KEEP_REMOTE':
      return 'UPSERT'; // Overwrite local with remote
    case 'TOMBSTONE':
      return 'TOMBSTONE';
    case 'MERGE':
      return 'UPSERT'; // For now merge falls back to remote
    default:
      return 'CONFLICT'; // Unresolved — mark for manual review
  }
}
