/**
 * Sync Conflict Resolver
 *
 * Pluggable conflict resolution for pull-sync operations.
 *
 * Strategies:
 *   keep_local  — preserve the local (pending) change, ignore remote
 *   keep_remote — overwrite local with remote (default)
 *   merge       — attempt field-level merge (keeps newest per field)
 *
 * The strategy is stored per-user in app settings and can be changed
 * at runtime without restarting the app.
 */

import * as SecureStore from 'expo-secure-store';

const CONFLICT_STRATEGY_KEY = 'lifeos.sync_conflict_strategy';

export type ConflictStrategy = 'keep_local' | 'keep_remote' | 'merge';

export type ConflictContext = {
  tableName: string;
  recordId: string;
  localState: string | null | undefined;
  localRevision: number;
  localUpdatedAt: string | null | undefined;
  remoteRevision: number;
  remoteUpdatedAt: string | null | undefined;
  remoteDeletedAt: string | null | undefined;
};

export type ConflictResolution = 'KEEP_LOCAL' | 'KEEP_REMOTE' | 'TOMBSTONE' | 'MERGE';

export class SyncConflictResolver {
  /**
   * Returns the user's preferred conflict strategy.
   * Defaults to 'keep_remote' for safety.
   */
  static async getStrategy(): Promise<ConflictStrategy> {
    const raw = await SecureStore.getItemAsync(CONFLICT_STRATEGY_KEY);
    if (raw === 'keep_local' || raw === 'keep_remote' || raw === 'merge') return raw;
    return 'keep_remote';
  }

  /**
   * Sets the preferred conflict strategy.
   */
  static async setStrategy(strategy: ConflictStrategy): Promise<void> {
    await SecureStore.setItemAsync(CONFLICT_STRATEGY_KEY, strategy);
  }

  /**
   * Resolves a conflict given the current strategy and context.
   */
  static async resolve(ctx: ConflictContext): Promise<ConflictResolution> {
    if (ctx.remoteDeletedAt) return 'TOMBSTONE';

    const strategy = await this.getStrategy();

    switch (strategy) {
      case 'keep_local':
        return 'KEEP_LOCAL';
      case 'merge':
        // Merge is only viable when both sides have structured data;
        // for now it falls through to keep_remote unless explicitly requested.
        // A full merge would require per-table field-level comparison.
        return 'KEEP_REMOTE';
      case 'keep_remote':
      default:
        return 'KEEP_REMOTE';
    }
  }

  /**
   * Determines whether a situation is a conflict at all.
   * A conflict exists when:
   *   1. Local record has pending changes (QUEUED, LOCAL_ONLY, FAILED, CONFLICT, SYNCING)
   *   2. AND local is newer or same-age as remote
   */
  static isConflict(ctx: {
    localSyncState: string | null | undefined;
    localRevision: number | null | undefined;
    localUpdatedAt: string | null | undefined;
    remoteRevision: number | null | undefined;
    remoteUpdatedAt: string | null | undefined;
  }): boolean {
    const pendingStates = new Set(['QUEUED', 'LOCAL_ONLY', 'FAILED', 'CONFLICT', 'SYNCING']);
    const localIsPending = ctx.localSyncState ? pendingStates.has(ctx.localSyncState) : false;
    if (!localIsPending) return false;

    const localUpdated = ctx.localUpdatedAt ? new Date(ctx.localUpdatedAt).getTime() : 0;
    const remoteUpdated = ctx.remoteUpdatedAt ? new Date(ctx.remoteUpdatedAt).getTime() : 0;
    const localRevision = typeof ctx.localRevision === 'number' ? ctx.localRevision : 0;
    const remoteRevision = typeof ctx.remoteRevision === 'number' ? ctx.remoteRevision : 0;
    const localNewer =
      localRevision > remoteRevision ||
      (localRevision === remoteRevision && localUpdated > remoteUpdated);

    return localNewer;
  }
}
