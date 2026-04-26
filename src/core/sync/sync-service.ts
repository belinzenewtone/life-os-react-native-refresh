import { getDatabase } from '@/core/data/database/client';
import { determinePullDecision } from '@/core/sync/pull-decision';
import { NetworkMonitor } from '@/core/sync/network-monitor';
import { SyncRepository } from '@/core/repositories/sync-repository';
import { hasSupabaseConfig } from '@/core/supabase/config';
import { supabaseClient } from '@/core/supabase/client';

const syncTables = [
  {
    name: 'transactions',
    columns: [
      'user_id',
      'id',
      'amount',
      'merchant',
      'category',
      'date',
      'source',
      'transaction_type',
      'mpesa_code',
      'source_hash',
      'semantic_hash',
      'raw_sms',
      'inferred_category',
      'inference_source',
      'created_at',
      'updated_at',
      'sync_state',
      'record_source',
      'revision',
      'deleted_at',
    ],
  },
  {
    name: 'tasks',
    columns: [
      'user_id',
      'id',
      'title',
      'description',
      'priority',
      'deadline',
      'status',
      'completed_at',
      'reminder_offsets',
      'alarm_enabled',
      'created_at',
      'updated_at',
      'sync_state',
      'record_source',
      'revision',
      'deleted_at',
    ],
  },
  {
    name: 'events',
    columns: [
      'user_id',
      'id',
      'title',
      'description',
      'date',
      'end_date',
      'type',
      'importance',
      'status',
      'has_reminder',
      'reminder_minutes_before',
      'kind',
      'all_day',
      'repeat_rule',
      'reminder_offsets',
      'alarm_enabled',
      'guests',
      'time_zone_id',
      'reminder_time_of_day_minutes',
      'created_at',
      'updated_at',
      'sync_state',
      'record_source',
      'revision',
      'deleted_at',
    ],
  },
  {
    name: 'budgets',
    columns: [
      'user_id',
      'id',
      'category',
      'limit_amount',
      'month_key',
      'created_at',
      'updated_at',
      'sync_state',
      'record_source',
      'revision',
      'deleted_at',
    ],
  },
  {
    name: 'incomes',
    columns: [
      'user_id',
      'id',
      'source',
      'amount',
      'date',
      'note',
      'created_at',
      'updated_at',
      'sync_state',
      'record_source',
      'revision',
      'deleted_at',
    ],
  },
  {
    name: 'recurring_rules',
    columns: [
      'user_id',
      'id',
      'label',
      'kind',
      'interval',
      'next_run_at',
      'amount',
      'active',
      'created_at',
      'updated_at',
      'sync_state',
      'record_source',
      'revision',
      'deleted_at',
    ],
  },
  {
    name: 'fuliza_loans',
    columns: [
      'user_id',
      'id',
      'outstanding_amount',
      'limit_amount',
      'last_charge_date',
      'last_repayment_date',
      'created_at',
      'updated_at',
      'sync_state',
      'record_source',
      'revision',
      'deleted_at',
    ],
  },
] as const;

type SyncTable = (typeof syncTables)[number];
type BindValue = string | number | null | Uint8Array | boolean;
type LocalSyncMeta = {
  updated_at: string | null;
  sync_state: string | null;
  revision: number | null;
  deleted_at: string | null;
};

function buildLocalUpsertSql(table: SyncTable) {
  const columns = table.columns.join(',');
  const placeholders = table.columns.map(() => '?').join(',');
  const updateColumns = table.columns.filter((column) => column !== 'user_id' && column !== 'id');
  const updateSet = updateColumns.map((column) => `${column}=excluded.${column}`).join(',');

  return `INSERT INTO ${table.name} (${columns}) VALUES (${placeholders}) ON CONFLICT(user_id,id) DO UPDATE SET ${updateSet}`;
}

async function pushTable(userId: string, table: SyncTable) {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT ${table.columns.join(',')} FROM ${table.name} WHERE user_id = ? AND sync_state IN ('QUEUED','LOCAL_ONLY','FAILED','CONFLICT')`,
    userId,
  );

  if (!rows.length) return;

  const payload = rows.map((row) => {
    const object: Record<string, unknown> = {};
    for (const column of table.columns) {
      object[column] = row[column];
    }
    return object;
  });

  const result = await supabaseClient.from(table.name).upsert(payload, { onConflict: 'user_id,id' });
  if (result.error) throw result.error;

  const ids = rows.map((row) => row.id as string);
  if (!ids.length) return;

  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(
    `UPDATE ${table.name} SET sync_state = 'SYNCED', updated_at = ? WHERE user_id = ? AND id IN (${placeholders})`,
    new Date().toISOString(),
    userId,
    ...ids,
  );
}

const PAGE_SIZE = 500;

async function getLastPulledAt(userId: string, tableName: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ last_pulled_at: string | null }>(
    'SELECT last_pulled_at FROM sync_runtime WHERE user_id = ?',
    userId,
  );
  if (!row?.last_pulled_at) return null;
  try {
    const meta = JSON.parse(row.last_pulled_at) as Record<string, string>;
    return meta[tableName] ?? null;
  } catch {
    return null;
  }
}

async function setLastPulledAt(userId: string, tableName: string, timestamp: string): Promise<void> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ last_pulled_at: string | null }>(
    'SELECT last_pulled_at FROM sync_runtime WHERE user_id = ?',
    userId,
  );
  let meta: Record<string, string> = {};
  if (row?.last_pulled_at) {
    try { meta = JSON.parse(row.last_pulled_at); } catch { /* ignore */ }
  }
  meta[tableName] = timestamp;
  await db.runAsync(
    `INSERT INTO sync_runtime (user_id,last_pulled_at,updated_at)
     VALUES (?,?,?)
     ON CONFLICT(user_id) DO UPDATE SET last_pulled_at=excluded.last_pulled_at,updated_at=excluded.updated_at`,
    userId,
    JSON.stringify(meta),
    new Date().toISOString(),
  );
}

async function pullTable(userId: string, table: SyncTable) {
  const lastPulledAt = await getLastPulledAt(userId, table.name);
  let page = 0;
  let hasMore = true;
  let newestTimestamp: string | null = null;
  const db = await getDatabase();
  const upsertSql = buildLocalUpsertSql(table);

  while (hasMore) {
    let query = supabaseClient
      .from(table.name)
      .select(table.columns.join(','))
      .eq('user_id', userId)
      .order('updated_at', { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (lastPulledAt) {
      query = query.gt('updated_at', lastPulledAt);
    }

    const result = await query;
    if (result.error) throw result.error;
    const remoteRows = (result.data ?? []) as unknown[];

    if (remoteRows.length === 0) {
      hasMore = false;
      break;
    }

    // Track newest timestamp for updating last_pulled_at
    const lastRow = remoteRows[remoteRows.length - 1] as Record<string, unknown>;
    const rowTs = typeof lastRow.updated_at === 'string' ? lastRow.updated_at : null;
    if (rowTs && (!newestTimestamp || rowTs > newestTimestamp)) {
      newestTimestamp = rowTs;
    }

    // Batch-fetch all local sync metadata in one query to avoid N+1 pattern
    const remoteIds = remoteRows
      .map((r) => String((r as Record<string, unknown>).id ?? ''))
      .filter(Boolean);

    const localRows = remoteIds.length
      ? await db.getAllAsync<LocalSyncMeta & { id: string }>(
          `SELECT id,updated_at,sync_state,revision,deleted_at FROM ${table.name} WHERE user_id = ? AND id IN (${remoteIds.map(() => '?').join(',')})`,
          userId,
          ...remoteIds,
        )
      : [];

    const localMap = new Map(localRows.map((r) => [r.id, r]));

    await db.withTransactionAsync(async () => {
      for (const row of remoteRows) {
        const asRecord = (row ?? {}) as Record<string, unknown>;
        const id = String(asRecord.id ?? '');
        if (!id) continue;

        const localRow = localMap.get(id) ?? null;

        const decision = await determinePullDecision({
          tableName: table.name,
          recordId: id,
          localUpdatedAt: localRow?.updated_at,
          localSyncState: localRow?.sync_state,
          localRevision: localRow?.revision,
          remoteUpdatedAt: typeof asRecord.updated_at === 'string' ? asRecord.updated_at : null,
          remoteRevision: typeof asRecord.revision === 'number' ? asRecord.revision : null,
          remoteDeletedAt: typeof asRecord.deleted_at === 'string' ? asRecord.deleted_at : null,
        });

        if (decision === 'SKIP') {
          // keep_local strategy: don't apply remote, local change remains pending
          continue;
        }

        if (decision === 'CONFLICT') {
          await db.runAsync(
            `UPDATE ${table.name} SET sync_state = ?, updated_at = ? WHERE user_id = ? AND id = ?`,
            'CONFLICT',
            new Date().toISOString(),
            userId,
            id,
          );
          continue;
        }

        if (decision === 'TOMBSTONE') {
          await db.runAsync(
            `UPDATE ${table.name}
             SET deleted_at = ?, sync_state = ?, record_source = ?, updated_at = ?
             WHERE user_id = ? AND id = ?`,
            String(asRecord.deleted_at),
            'TOMBSTONED',
            'CLOUD',
            new Date().toISOString(),
            userId,
            id,
          );
          continue;
        }

        asRecord.user_id = userId;
        asRecord.sync_state = 'SYNCED';
        asRecord.record_source = 'CLOUD';
        const values = table.columns.map((column): BindValue => {
          const value = asRecord[column];
          if (value == null) return null;
          if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
          if (value instanceof Uint8Array) return value;
          return JSON.stringify(value);
        });
        await db.runAsync(upsertSql, ...values);
      }
    });

    hasMore = remoteRows.length === PAGE_SIZE;
    page += 1;
  }

  // Update last_pulled_at to the newest timestamp seen
  if (newestTimestamp) {
    await setLastPulledAt(userId, table.name, newestTimestamp);
  } else if (!lastPulledAt) {
    // First pull with no results: set to now so future pulls are delta
    await setLastPulledAt(userId, table.name, new Date().toISOString());
  }
}

export class SyncService {
  static async pushAll(userId: string) {
    if (!hasSupabaseConfig()) return;
    NetworkMonitor.assertOnline();
    for (const table of syncTables) {
      await pushTable(userId, table);
    }
  }

  static async pullAll(userId: string) {
    if (!hasSupabaseConfig()) return;
    NetworkMonitor.assertOnline();
    for (const table of syncTables) {
      await pullTable(userId, table);
    }
  }

  static async repairAll(userId: string) {
    if (!hasSupabaseConfig()) return;
    NetworkMonitor.assertOnline();
    await this.pushAll(userId);
    await this.pullAll(userId);
  }
}
