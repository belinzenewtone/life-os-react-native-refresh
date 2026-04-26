import { getDatabase } from '@/core/data/database/client';

export type BudgetRecord = {
  id: string;
  category: string;
  limit_amount: number;
  month_key: string;
};

export type IncomeRecord = {
  id: string;
  source: string;
  amount: number;
  date: number;
  note: string;
};

export type RecurringRuleRecord = {
  id: string;
  label: string;
  kind: string;
  interval: string;
  next_run_at: number;
  amount: number | null;
  active: number;
};

function nowIso() {
  return new Date().toISOString();
}

function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------
export class BudgetRepository {
  static async list(userId: string): Promise<BudgetRecord[]> {
    const db = await getDatabase();
    return db.getAllAsync<BudgetRecord>(
      "SELECT id,category,limit_amount,month_key FROM budgets WHERE user_id = ? AND deleted_at IS NULL ORDER BY category ASC",
      userId,
    );
  }

  static async create(
    userId: string,
    input: { category: string; limit_amount: number; month_key?: string },
  ): Promise<string> {
    const db = await getDatabase();
    const id = genId('budget');
    const created = nowIso();
    const monthKey = input.month_key ?? new Date().toISOString().slice(0, 7);
    await db.runAsync(
      `INSERT INTO budgets (user_id,id,category,limit_amount,month_key,created_at,updated_at,sync_state,record_source,revision,deleted_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      userId,
      id,
      input.category,
      input.limit_amount,
      monthKey,
      created,
      created,
      'QUEUED',
      'LOCAL',
      1,
      null,
    );
    return id;
  }

  static async update(
    userId: string,
    id: string,
    patch: { category?: string; limit_amount?: number; month_key?: string },
  ): Promise<void> {
    const db = await getDatabase();
    const current = await db.getFirstAsync<BudgetRecord>(
      'SELECT id,category,limit_amount,month_key FROM budgets WHERE user_id = ? AND id = ?',
      userId,
      id,
    );
    if (!current) return;
    await db.runAsync(
      `UPDATE budgets
         SET category = ?, limit_amount = ?, month_key = ?, updated_at = ?, sync_state = ?, revision = revision + 1
         WHERE user_id = ? AND id = ?`,
      patch.category ?? current.category,
      patch.limit_amount ?? current.limit_amount,
      patch.month_key ?? current.month_key,
      nowIso(),
      'QUEUED',
      userId,
      id,
    );
  }

  static async remove(userId: string, id: string): Promise<void> {
    const db = await getDatabase();
    const ts = nowIso();
    await db.runAsync(
      `UPDATE budgets SET deleted_at = ?, updated_at = ?, sync_state = ?, revision = revision + 1
        WHERE user_id = ? AND id = ?`,
      ts,
      ts,
      'QUEUED',
      userId,
      id,
    );
  }
}

// ---------------------------------------------------------------------------
// Incomes
// ---------------------------------------------------------------------------
export class IncomeRepository {
  static async list(userId: string): Promise<IncomeRecord[]> {
    const db = await getDatabase();
    return db.getAllAsync<IncomeRecord>(
      'SELECT id,source,amount,date,note FROM incomes WHERE user_id = ? AND deleted_at IS NULL ORDER BY date DESC',
      userId,
    );
  }

  static async create(
    userId: string,
    input: { source: string; amount: number; date?: number; note?: string },
  ): Promise<string> {
    const db = await getDatabase();
    const id = genId('income');
    const created = nowIso();
    await db.runAsync(
      `INSERT INTO incomes (user_id,id,source,amount,date,note,created_at,updated_at,sync_state,record_source,revision,deleted_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      userId,
      id,
      input.source,
      input.amount,
      input.date ?? Date.now(),
      input.note ?? '',
      created,
      created,
      'QUEUED',
      'LOCAL',
      1,
      null,
    );
    return id;
  }

  static async update(
    userId: string,
    id: string,
    patch: { source?: string; amount?: number; date?: number; note?: string },
  ): Promise<void> {
    const db = await getDatabase();
    const current = await db.getFirstAsync<IncomeRecord>(
      'SELECT id,source,amount,date,note FROM incomes WHERE user_id = ? AND id = ?',
      userId,
      id,
    );
    if (!current) return;
    await db.runAsync(
      `UPDATE incomes SET source = ?, amount = ?, date = ?, note = ?, updated_at = ?, sync_state = ?, revision = revision + 1
        WHERE user_id = ? AND id = ?`,
      patch.source ?? current.source,
      patch.amount ?? current.amount,
      patch.date ?? current.date,
      patch.note ?? current.note,
      nowIso(),
      'QUEUED',
      userId,
      id,
    );
  }

  static async remove(userId: string, id: string): Promise<void> {
    const db = await getDatabase();
    const ts = nowIso();
    await db.runAsync(
      `UPDATE incomes SET deleted_at = ?, updated_at = ?, sync_state = ?, revision = revision + 1
        WHERE user_id = ? AND id = ?`,
      ts,
      ts,
      'QUEUED',
      userId,
      id,
    );
  }
}

// ---------------------------------------------------------------------------
// Recurring rules
// ---------------------------------------------------------------------------
export class RecurringRepository {
  static async list(userId: string): Promise<RecurringRuleRecord[]> {
    const db = await getDatabase();
    return db.getAllAsync<RecurringRuleRecord>(
      'SELECT id,label,kind,interval,next_run_at,amount,active FROM recurring_rules WHERE user_id = ? AND deleted_at IS NULL ORDER BY next_run_at ASC',
      userId,
    );
  }

  static async create(
    userId: string,
    input: {
      label: string;
      kind?: string;
      interval?: string;
      next_run_at?: number;
      amount?: number | null;
      active?: boolean;
    },
  ): Promise<string> {
    const db = await getDatabase();
    const id = genId('recurring');
    const created = nowIso();
    await db.runAsync(
      `INSERT INTO recurring_rules (user_id,id,label,kind,interval,next_run_at,amount,active,created_at,updated_at,sync_state,record_source,revision,deleted_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      userId,
      id,
      input.label,
      input.kind ?? 'EXPENSE',
      input.interval ?? 'MONTHLY',
      input.next_run_at ?? Date.now() + 7 * 24 * 60 * 60 * 1000,
      input.amount ?? null,
      input.active === false ? 0 : 1,
      created,
      created,
      'QUEUED',
      'LOCAL',
      1,
      null,
    );
    return id;
  }

  static async update(
    userId: string,
    id: string,
    patch: {
      label?: string;
      kind?: string;
      interval?: string;
      next_run_at?: number;
      amount?: number | null;
      active?: boolean;
    },
  ): Promise<void> {
    const db = await getDatabase();
    const current = await db.getFirstAsync<RecurringRuleRecord>(
      'SELECT id,label,kind,interval,next_run_at,amount,active FROM recurring_rules WHERE user_id = ? AND id = ?',
      userId,
      id,
    );
    if (!current) return;
    await db.runAsync(
      `UPDATE recurring_rules
         SET label = ?, kind = ?, interval = ?, next_run_at = ?, amount = ?, active = ?, updated_at = ?, sync_state = ?, revision = revision + 1
         WHERE user_id = ? AND id = ?`,
      patch.label ?? current.label,
      patch.kind ?? current.kind,
      patch.interval ?? current.interval,
      patch.next_run_at ?? current.next_run_at,
      patch.amount === undefined ? current.amount : patch.amount,
      patch.active === undefined ? current.active : patch.active ? 1 : 0,
      nowIso(),
      'QUEUED',
      userId,
      id,
    );
  }

  static async toggleActive(userId: string, id: string): Promise<void> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ active: number }>(
      'SELECT active FROM recurring_rules WHERE user_id = ? AND id = ?',
      userId,
      id,
    );
    if (!row) return;
    await db.runAsync(
      `UPDATE recurring_rules SET active = ?, updated_at = ?, sync_state = ?, revision = revision + 1
        WHERE user_id = ? AND id = ?`,
      row.active ? 0 : 1,
      nowIso(),
      'QUEUED',
      userId,
      id,
    );
  }

  static async remove(userId: string, id: string): Promise<void> {
    const db = await getDatabase();
    const ts = nowIso();
    await db.runAsync(
      `UPDATE recurring_rules SET deleted_at = ?, updated_at = ?, sync_state = ?, revision = revision + 1
        WHERE user_id = ? AND id = ?`,
      ts,
      ts,
      'QUEUED',
      userId,
      id,
    );
  }
}
