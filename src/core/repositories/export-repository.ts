import { getDatabase } from '@/core/data/database/client';

export type ExportDomain = 'ALL' | 'TASKS' | 'EVENTS' | 'TRANSACTIONS';
export type DatePreset = 'ALL_TIME' | 'LAST_30_DAYS' | 'LAST_7_DAYS';
export type ExportCounts = { tasks: number; events: number; transactions: number };

function getDateCutoffMs(preset: DatePreset): number | null {
  if (preset === 'ALL_TIME') return null;
  const days = preset === 'LAST_7_DAYS' ? 7 : 30;
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function getDateCutoffIso(preset: DatePreset): string | null {
  const ms = getDateCutoffMs(preset);
  if (ms === null) return null;
  return new Date(ms).toISOString();
}

export type ExportedTask = Record<string, unknown>;
export type ExportedEvent = Record<string, unknown>;
export type ExportedTransaction = Record<string, unknown>;
export type ExportPayload = {
  generated_at: string;
  user_id: string;
  record_counts: ExportCounts;
  tasks: ExportedTask[];
  events: ExportedEvent[];
  transactions: ExportedTransaction[];
};

export class ExportRepository {
  static async getCounts(userId: string, domain: ExportDomain, datePreset: DatePreset): Promise<ExportCounts> {
    const db = await getDatabase();
    const cutoffIso = getDateCutoffIso(datePreset);
    const cutoffMs = getDateCutoffMs(datePreset);

    let tasks = 0;
    let events = 0;
    let transactions = 0;

    if (domain === 'ALL' || domain === 'TASKS') {
      const params: (string | number)[] = [userId];
      if (cutoffIso !== null) params.push(cutoffIso);
      const row = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND deleted_at IS NULL${cutoffIso !== null ? ' AND created_at >= ?' : ''}`,
        ...params,
      );
      tasks = row?.count ?? 0;
    }

    if (domain === 'ALL' || domain === 'EVENTS') {
      const params: (string | number)[] = [userId];
      if (cutoffMs !== null) params.push(cutoffMs);
      const row = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM events WHERE user_id = ? AND deleted_at IS NULL${cutoffMs !== null ? ' AND date >= ?' : ''}`,
        ...params,
      );
      events = row?.count ?? 0;
    }

    if (domain === 'ALL' || domain === 'TRANSACTIONS') {
      const params: (string | number)[] = [userId];
      if (cutoffMs !== null) params.push(cutoffMs);
      const row = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND deleted_at IS NULL${cutoffMs !== null ? ' AND date >= ?' : ''}`,
        ...params,
      );
      transactions = row?.count ?? 0;
    }

    return { tasks, events, transactions };
  }

  static async buildPayload(
    userId: string,
    domain: ExportDomain,
    datePreset: DatePreset,
  ): Promise<ExportPayload> {
    const db = await getDatabase();
    const cutoffIso = getDateCutoffIso(datePreset);
    const cutoffMs = getDateCutoffMs(datePreset);

    let tasks: ExportedTask[] = [];
    let events: ExportedEvent[] = [];
    let transactions: ExportedTransaction[] = [];

    if (domain === 'ALL' || domain === 'TASKS') {
      const params: (string | number)[] = [userId];
      if (cutoffIso !== null) params.push(cutoffIso);
      tasks = await db.getAllAsync<ExportedTask>(
        `SELECT * FROM tasks WHERE user_id = ? AND deleted_at IS NULL${cutoffIso !== null ? ' AND created_at >= ?' : ''}`,
        ...params,
      );
    }

    if (domain === 'ALL' || domain === 'EVENTS') {
      const params: (string | number)[] = [userId];
      if (cutoffMs !== null) params.push(cutoffMs);
      events = await db.getAllAsync<ExportedEvent>(
        `SELECT * FROM events WHERE user_id = ? AND deleted_at IS NULL${cutoffMs !== null ? ' AND date >= ?' : ''}`,
        ...params,
      );
    }

    if (domain === 'ALL' || domain === 'TRANSACTIONS') {
      const params: (string | number)[] = [userId];
      if (cutoffMs !== null) params.push(cutoffMs);
      transactions = await db.getAllAsync<ExportedTransaction>(
        `SELECT * FROM transactions WHERE user_id = ? AND deleted_at IS NULL${cutoffMs !== null ? ' AND date >= ?' : ''}`,
        ...params,
      );
    }

    return {
      generated_at: new Date().toISOString(),
      user_id: userId,
      record_counts: {
        tasks: tasks.length,
        events: events.length,
        transactions: transactions.length,
      },
      tasks,
      events,
      transactions,
    };
  }

  static async importPayload(userId: string, payload: ExportPayload): Promise<number> {
    const db = await getDatabase();
    let imported = 0;
    await db.withTransactionAsync(async () => {
      if (payload.tasks.length) {
        for (const task of payload.tasks as Record<string, unknown>[]) {
          await db.runAsync(
            `INSERT OR IGNORE INTO tasks (user_id,id,title,description,priority,deadline,status,completed_at,reminder_offsets,alarm_enabled,created_at,updated_at,sync_state,record_source,revision,deleted_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            userId,
            (String(task['id']) || `task_${Date.now()}`),
            (String(task['title']) || ''),
            (String(task['description']) || ''),
            (String(task['priority']) || 'MEDIUM'),
            (task['deadline'] as number | null) ?? null,
            (String(task['status']) || 'PENDING'),
            (task['completed_at'] as number | null) ?? null,
            (String(task['reminder_offsets']) || ''),
            (Number(task['alarm_enabled']) || 0),
            (String(task['created_at']) || new Date().toISOString()),
            (String(task['updated_at']) || new Date().toISOString()),
            'QUEUED',
            'IMPORTED',
            1,
            null,
          );
          imported += 1;
        }
      }
      if (payload.events.length) {
        for (const event of payload.events as Record<string, unknown>[]) {
          await db.runAsync(
            `INSERT OR IGNORE INTO events (user_id,id,title,description,date,end_date,type,importance,status,has_reminder,reminder_minutes_before,kind,all_day,repeat_rule,reminder_offsets,alarm_enabled,guests,time_zone_id,reminder_time_of_day_minutes,created_at,updated_at,sync_state,record_source,revision,deleted_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            userId,
            (String(event['id']) || `event_${Date.now()}`),
            (String(event['title']) || ''),
            (String(event['description']) || ''),
            (Number(event['date']) || Date.now()),
            (Number(event['end_date']) as number | null) ?? null,
            (String(event['type']) || 'WORK'),
            (String(event['importance']) || 'IMPORTANT'),
            (String(event['status']) || 'PENDING'),
            (Number(event['has_reminder']) || 0),
            (Number(event['reminder_minutes_before']) || 15),
            (String(event['kind']) || 'EVENT'),
            (Number(event['all_day']) || 0),
            (String(event['repeat_rule']) || 'NEVER'),
            (String(event['reminder_offsets']) || ''),
            (Number(event['alarm_enabled']) || 0),
            (String(event['guests']) || ''),
            (String(event['time_zone_id']) || 'Africa/Nairobi'),
            (Number(event['reminder_time_of_day_minutes']) || 480),
            (String(event['created_at']) || new Date().toISOString()),
            (String(event['updated_at']) || new Date().toISOString()),
            'QUEUED',
            'IMPORTED',
            1,
            null,
          );
          imported += 1;
        }
      }
      if (payload.transactions.length) {
        for (const tx of payload.transactions as Record<string, unknown>[]) {
          await db.runAsync(
            `INSERT OR IGNORE INTO transactions (user_id,id,amount,merchant,category,date,source,transaction_type,mpesa_code,source_hash,semantic_hash,raw_sms,inferred_category,inference_source,created_at,updated_at,sync_state,record_source,revision,deleted_at,balance)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            userId,
            (String(tx['id']) || `tx_${Date.now()}`),
            (Number(tx['amount']) || 0),
            (String(tx['merchant']) || ''),
            (String(tx['category']) || 'Other'),
            (Number(tx['date']) || Date.now()),
            (String(tx['source']) || 'Import'),
            (String(tx['transaction_type']) || 'PAID'),
            (String(tx['mpesa_code']) || null),
            (String(tx['source_hash']) || null),
            (String(tx['semantic_hash']) || null),
            (String(tx['raw_sms']) || null),
            (String(tx['inferred_category']) || null),
            (String(tx['inference_source']) || null),
            (String(tx['created_at']) || new Date().toISOString()),
            (String(tx['updated_at']) || new Date().toISOString()),
            'QUEUED',
            'IMPORTED',
            1,
            null,
            (Number(tx['balance']) as number | null) ?? null,
          );
          imported += 1;
        }
      }
    });
    return imported;
  }
}
