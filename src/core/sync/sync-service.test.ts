import { describe, expect, it, vi } from 'vitest';

const mockStore = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn((key: string) => Promise.resolve(mockStore.get(key) ?? null)),
  setItemAsync: vi.fn((key: string, value: string) => { mockStore.set(key, value); return Promise.resolve(); }),
  deleteItemAsync: vi.fn((key: string) => { mockStore.delete(key); return Promise.resolve(); }),
}));

import { determinePullDecision } from './pull-decision';
import { SyncConflictResolver } from './sync-conflict-resolver';

describe('determinePullDecision', () => {
  it('returns UPSERT when local pending row is newer than remote and strategy is keep_remote', async () => {
    await SyncConflictResolver.setStrategy('keep_remote');
    const decision = await determinePullDecision({
      tableName: 'transactions',
      recordId: 'tx_1',
      localUpdatedAt: '2026-04-22T12:00:00.000Z',
      localSyncState: 'QUEUED',
      localRevision: 5,
      remoteUpdatedAt: '2026-04-22T10:00:00.000Z',
      remoteRevision: 4,
      remoteDeletedAt: null,
    });

    expect(decision).toBe('UPSERT');
  });

  it('returns TOMBSTONE when remote row is deleted and no newer local pending override', async () => {
    const decision = await determinePullDecision({
      tableName: 'transactions',
      recordId: 'tx_2',
      localUpdatedAt: '2026-04-20T10:00:00.000Z',
      localSyncState: 'SYNCED',
      localRevision: 1,
      remoteUpdatedAt: '2026-04-22T10:00:00.000Z',
      remoteRevision: 2,
      remoteDeletedAt: '2026-04-22T10:00:00.000Z',
    });

    expect(decision).toBe('TOMBSTONE');
  });

  it('returns UPSERT when remote row should be applied', async () => {
    const decision = await determinePullDecision({
      tableName: 'transactions',
      recordId: 'tx_3',
      localUpdatedAt: '2026-04-20T10:00:00.000Z',
      localSyncState: 'SYNCED',
      localRevision: 1,
      remoteUpdatedAt: '2026-04-22T10:00:00.000Z',
      remoteRevision: 2,
      remoteDeletedAt: null,
    });

    expect(decision).toBe('UPSERT');
  });

  it('returns SKIP with keep_local strategy', async () => {
    await SyncConflictResolver.setStrategy('keep_local');
    const decision = await determinePullDecision({
      tableName: 'transactions',
      recordId: 'tx_4',
      localUpdatedAt: '2026-04-22T12:00:00.000Z',
      localSyncState: 'QUEUED',
      localRevision: 5,
      remoteUpdatedAt: '2026-04-22T10:00:00.000Z',
      remoteRevision: 4,
      remoteDeletedAt: null,
    });

    expect(decision).toBe('SKIP');
  });
});
