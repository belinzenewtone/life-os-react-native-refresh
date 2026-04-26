import { getDatabase } from '@/core/data/database/client';

export type EventRecord = {
  id: string;
  title: string;
  date: number;
  end_date: number | null;
  kind: 'EVENT' | 'BIRTHDAY' | 'ANNIVERSARY' | 'COUNTDOWN';
  type: 'WORK' | 'PERSONAL' | 'HEALTH' | 'FINANCE' | 'OTHER';
  status: 'PENDING' | 'COMPLETED';
  all_day: number;
};

export class EventRepository {
  static async listByMonth(userId: string, year: number, month: number): Promise<EventRecord[]> {
    const db = await getDatabase();
    const start = new Date(year, month, 1).getTime();
    const end = new Date(year, month + 1, 1).getTime();
    return db.getAllAsync<EventRecord>(
      'SELECT id,title,date,end_date,kind,type,status,all_day FROM events WHERE user_id = ? AND date >= ? AND date < ? AND deleted_at IS NULL ORDER BY date ASC',
      userId,
      start,
      end,
    );
  }

  static async create(
    userId: string,
    input: {
      title: string;
      description?: string;
      date: number;
      end_date?: number | null;
      kind?: EventRecord['kind'];
      type?: EventRecord['type'];
      importance?: 'NEUTRAL' | 'IMPORTANT' | 'CRITICAL';
      status?: EventRecord['status'];
      has_reminder?: boolean;
      reminder_minutes_before?: number;
      all_day?: boolean;
      repeat_rule?: 'NEVER' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
      reminder_offsets?: string;
      alarm_enabled?: boolean;
      guests?: string;
      time_zone_id?: string;
      reminder_time_of_day_minutes?: number;
    },
  ) {
    const db = await getDatabase();
    const nowIso = new Date().toISOString();
    const id = `event_${Date.now()}`;
    await db.runAsync(
      `INSERT INTO events (
        user_id,id,title,description,date,end_date,type,importance,status,has_reminder,reminder_minutes_before,kind,
        all_day,repeat_rule,reminder_offsets,alarm_enabled,guests,time_zone_id,reminder_time_of_day_minutes,
        created_at,updated_at,sync_state,record_source,revision,deleted_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      userId,
      id,
      input.title,
      input.description ?? '',
      input.date,
      input.end_date ?? null,
      input.type ?? 'WORK',
      input.importance ?? 'IMPORTANT',
      input.status ?? 'PENDING',
      input.has_reminder === false ? 0 : 1,
      input.reminder_minutes_before ?? 15,
      input.kind ?? 'EVENT',
      input.all_day ? 1 : 0,
      input.repeat_rule ?? 'NEVER',
      input.reminder_offsets ?? '15,60',
      input.alarm_enabled === false ? 0 : 1,
      input.guests ?? '',
      input.time_zone_id ?? 'Africa/Nairobi',
      input.reminder_time_of_day_minutes ?? 480,
      nowIso,
      nowIso,
      'QUEUED',
      'LOCAL',
      1,
      null,
    );
    return id;
  }

  static async findById(userId: string, id: string): Promise<EventRecord | null> {
    const db = await getDatabase();
    return db.getFirstAsync<EventRecord>(
      'SELECT id,title,date,end_date,kind,type,status,all_day FROM events WHERE user_id = ? AND id = ?',
      userId,
      id,
    );
  }

  static async update(
    userId: string,
    id: string,
    patch: {
      title?: string;
      date?: number;
      end_date?: number | null;
      kind?: EventRecord['kind'];
      type?: EventRecord['type'];
      all_day?: boolean;
      status?: EventRecord['status'];
    },
  ) {
    const db = await getDatabase();
    const current = await this.findById(userId, id);
    if (!current) return;
    await db.runAsync(
      `UPDATE events
         SET title = ?, date = ?, end_date = ?, kind = ?, type = ?, all_day = ?, status = ?, updated_at = ?, sync_state = ?, revision = revision + 1
         WHERE user_id = ? AND id = ?`,
      patch.title ?? current.title,
      patch.date ?? current.date,
      patch.end_date === undefined ? current.end_date : patch.end_date,
      patch.kind ?? current.kind,
      patch.type ?? current.type,
      patch.all_day === undefined ? current.all_day : patch.all_day ? 1 : 0,
      patch.status ?? current.status,
      new Date().toISOString(),
      'QUEUED',
      userId,
      id,
    );
  }

  static async remove(userId: string, id: string) {
    const db = await getDatabase();
    const ts = new Date().toISOString();
    await db.runAsync(
      `UPDATE events SET deleted_at = ?, updated_at = ?, sync_state = ?, revision = revision + 1
        WHERE user_id = ? AND id = ?`,
      ts,
      ts,
      'QUEUED',
      userId,
      id,
    );
  }

  static async findNearestFuture(userId: string): Promise<EventRecord | null> {
    const db = await getDatabase();
    return db.getFirstAsync<EventRecord>(
      'SELECT id,title,date,end_date,kind,type,status,all_day FROM events WHERE user_id = ? AND date >= ? AND deleted_at IS NULL ORDER BY date ASC LIMIT 1',
      userId,
      Date.now(),
    );
  }
}
