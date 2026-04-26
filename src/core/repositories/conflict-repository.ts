import { getDatabase } from '@/core/data/database/client';

export type ConflictItem = {
  table: string;
  id: string;
  preview: string;
  updated_at: string;
};

const conflictTables = [
  { name: 'transactions', previewColumn: 'merchant' },
  { name: 'tasks', previewColumn: 'title' },
  { name: 'events', previewColumn: 'title' },
  { name: 'budgets', previewColumn: 'category' },
  { name: 'incomes', previewColumn: 'source' },
  { name: 'recurring_rules', previewColumn: 'label' },
] as const;

export class ConflictRepository {
  static async listConflicts(userId: string): Promise<ConflictItem[]> {
    const db = await getDatabase();
    const results: ConflictItem[] = [];
    for (const { name, previewColumn } of conflictTables) {
      const rows = await db.getAllAsync<{ id: string; preview: string; updated_at: string }>(
        `SELECT id, ${previewColumn} AS preview, updated_at FROM ${name} WHERE user_id = ? AND sync_state = 'CONFLICT' AND deleted_at IS NULL`,
        userId,
      );
      for (const row of rows) {
        results.push({ table: name, id: row.id, preview: row.preview, updated_at: row.updated_at });
      }
    }
    results.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return results;
  }

  static async resolveConflict(
    userId: string,
    table: string,
    id: string,
    strategy: 'LOCAL' | 'REMOTE',
  ): Promise<void> {
    const db = await getDatabase();
    const nextState = strategy === 'LOCAL' ? 'QUEUED' : 'SYNCED';
    await db.runAsync(
      `UPDATE ${table} SET sync_state = ?, updated_at = ? WHERE user_id = ? AND id = ?`,
      nextState,
      new Date().toISOString(),
      userId,
      id,
    );
  }

  static async resolveAllConflicts(userId: string, strategy: 'LOCAL' | 'REMOTE'): Promise<void> {
    const db = await getDatabase();
    const nextState = strategy === 'LOCAL' ? 'QUEUED' : 'SYNCED';
    for (const { name } of conflictTables) {
      await db.runAsync(
        `UPDATE ${name} SET sync_state = ?, updated_at = ? WHERE user_id = ? AND sync_state = 'CONFLICT'`,
        nextState,
        new Date().toISOString(),
        userId,
      );
    }
  }

  static async countConflicts(userId: string): Promise<number> {
    const db = await getDatabase();
    let total = 0;
    for (const { name } of conflictTables) {
      const row = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count FROM ${name} WHERE user_id = ? AND sync_state = 'CONFLICT' AND deleted_at IS NULL`,
        userId,
      );
      total += row?.count ?? 0;
    }
    return total;
  }
}
