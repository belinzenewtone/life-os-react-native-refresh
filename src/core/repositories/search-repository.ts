import { getDatabase } from '@/core/data/database/client';

export type SearchResult = {
  type: 'task' | 'event' | 'transaction';
  id: string;
  title: string;
  subtitle: string;
  eventDate?: number;
};

export class SearchRepository {
  static async query(userId: string, term: string): Promise<SearchResult[]> {
    const db = await getDatabase();
    const q = `%${term.trim()}%`;
    if (!term.trim()) return [];

    const [tasks, events, txs] = await Promise.all([
      db.getAllAsync<{ id: string; title: string; status: string }>('SELECT id,title,status FROM tasks WHERE user_id = ? AND title LIKE ? LIMIT 8', userId, q),
      db.getAllAsync<{ id: string; title: string; kind: string; date: number }>(
        'SELECT id,title,kind,date FROM events WHERE user_id = ? AND title LIKE ? LIMIT 8',
        userId,
        q,
      ),
      db.getAllAsync<{ id: string; merchant: string; category: string }>('SELECT id,merchant,category FROM transactions WHERE user_id = ? AND merchant LIKE ? LIMIT 8', userId, q),
    ]);

    return [
      ...tasks.map((row) => ({ type: 'task' as const, id: row.id, title: row.title, subtitle: row.status })),
      ...events.map((row) => ({
        type: 'event' as const,
        id: row.id,
        title: row.title,
        subtitle: row.kind,
        eventDate: row.date,
      })),
      ...txs.map((row) => ({ type: 'transaction' as const, id: row.id, title: row.merchant, subtitle: row.category })),
    ];
  }
}
