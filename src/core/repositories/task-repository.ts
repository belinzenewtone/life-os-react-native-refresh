import { getDatabase } from '@/core/data/database/client';

export type TaskRecord = {
  id: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  deadline: number | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  completed_at: number | null;
  reminder_offsets: string;
  alarm_enabled: number;
};

export class TaskRepository {
  static async list(userId: string): Promise<TaskRecord[]> {
    const db = await getDatabase();
    return db.getAllAsync<TaskRecord>(
      'SELECT id,title,description,priority,deadline,status,completed_at,reminder_offsets,alarm_enabled FROM tasks WHERE user_id = ? AND deleted_at IS NULL ORDER BY COALESCE(deadline, 9999999999999) ASC',
      userId,
    );
  }

  static async create(
    userId: string,
    input: {
      title: string;
      description?: string;
      priority?: TaskRecord['priority'];
      deadline?: number | null;
      reminder_offsets?: string;
      alarm_enabled?: boolean;
    },
  ) {
    const db = await getDatabase();
    const nowIso = new Date().toISOString();
    const id = `task_${Date.now()}`;
    await db.runAsync(
      `INSERT INTO tasks (
        user_id,id,title,description,priority,deadline,status,completed_at,reminder_offsets,alarm_enabled,
        created_at,updated_at,sync_state,record_source,revision,deleted_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      userId,
      id,
      input.title,
      input.description ?? '',
      input.priority ?? 'MEDIUM',
      input.deadline ?? null,
      'PENDING',
      null,
      input.reminder_offsets ?? '15,60',
      input.alarm_enabled === false ? 0 : 1,
      nowIso,
      nowIso,
      'QUEUED',
      'LOCAL',
      1,
      null,
    );
    return id;
  }

  static async toggleComplete(userId: string, id: string) {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ status: string }>('SELECT status FROM tasks WHERE user_id = ? AND id = ?', userId, id);
    if (!row) return;
    const completed = row.status !== 'COMPLETED';
    await this.setCompleted(userId, id, completed);
  }

  static async setCompleted(userId: string, id: string, completed: boolean) {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE tasks SET status = ?, completed_at = ?, updated_at = ?, sync_state = ?, revision = revision + 1 WHERE user_id = ? AND id = ?',
      completed ? 'COMPLETED' : 'PENDING',
      completed ? Date.now() : null,
      new Date().toISOString(),
      'QUEUED',
      userId,
      id,
    );
  }

  static async findById(userId: string, id: string): Promise<TaskRecord | null> {
    const db = await getDatabase();
    return db.getFirstAsync<TaskRecord>(
      'SELECT id,title,description,priority,deadline,status,completed_at,reminder_offsets,alarm_enabled FROM tasks WHERE user_id = ? AND id = ?',
      userId,
      id,
    );
  }

  static async update(
    userId: string,
    id: string,
    patch: { title?: string; description?: string; priority?: TaskRecord['priority']; deadline?: number | null },
  ) {
    const db = await getDatabase();
    const current = await this.findById(userId, id);
    if (!current) return;
    await db.runAsync(
      `UPDATE tasks SET title = ?, description = ?, priority = ?, deadline = ?, updated_at = ?, sync_state = ?, revision = revision + 1
        WHERE user_id = ? AND id = ?`,
      patch.title ?? current.title,
      patch.description ?? current.description,
      patch.priority ?? current.priority,
      patch.deadline === undefined ? current.deadline : patch.deadline,
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
      `UPDATE tasks SET deleted_at = ?, updated_at = ?, sync_state = ?, revision = revision + 1
        WHERE user_id = ? AND id = ?`,
      ts,
      ts,
      'QUEUED',
      userId,
      id,
    );
  }
}
