import { getDatabase } from '@/core/data/database/client';

const CURRENT_VERSION = 7;

const MIGRATIONS: Record<number, string[]> = {
  1: [
    `CREATE TABLE IF NOT EXISTS transactions (
      user_id TEXT NOT NULL,
      id TEXT NOT NULL,
      amount REAL NOT NULL,
      merchant TEXT NOT NULL,
      category TEXT NOT NULL,
      date INTEGER NOT NULL,
      source TEXT NOT NULL,
      transaction_type TEXT NOT NULL,
      mpesa_code TEXT,
      source_hash TEXT,
      semantic_hash TEXT,
      raw_sms TEXT,
      balance REAL,
      inferred_category TEXT,
      inference_source TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_state TEXT NOT NULL,
      record_source TEXT NOT NULL,
      revision INTEGER NOT NULL,
      deleted_at TEXT,
      PRIMARY KEY (user_id, id)
    );`,
    `CREATE TABLE IF NOT EXISTS tasks (
      user_id TEXT NOT NULL,
      id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL,
      deadline INTEGER,
      status TEXT NOT NULL,
      completed_at INTEGER,
      reminder_offsets TEXT NOT NULL,
      alarm_enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_state TEXT NOT NULL,
      record_source TEXT NOT NULL,
      revision INTEGER NOT NULL,
      deleted_at TEXT,
      PRIMARY KEY (user_id, id)
    );`,
    `CREATE TABLE IF NOT EXISTS events (
      user_id TEXT NOT NULL,
      id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      date INTEGER NOT NULL,
      end_date INTEGER,
      type TEXT NOT NULL,
      importance TEXT NOT NULL,
      status TEXT NOT NULL,
      has_reminder INTEGER NOT NULL,
      reminder_minutes_before INTEGER NOT NULL,
      kind TEXT NOT NULL,
      all_day INTEGER NOT NULL,
      repeat_rule TEXT NOT NULL,
      reminder_offsets TEXT NOT NULL,
      alarm_enabled INTEGER NOT NULL,
      guests TEXT NOT NULL DEFAULT '',
      time_zone_id TEXT NOT NULL DEFAULT 'Africa/Nairobi',
      reminder_time_of_day_minutes INTEGER NOT NULL DEFAULT 480,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_state TEXT NOT NULL,
      record_source TEXT NOT NULL,
      revision INTEGER NOT NULL,
      deleted_at TEXT,
      PRIMARY KEY (user_id, id)
    );`,
    `CREATE TABLE IF NOT EXISTS app_settings (
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, key)
    );`,
    `CREATE TABLE IF NOT EXISTS budgets (
      user_id TEXT NOT NULL,
      id TEXT NOT NULL,
      category TEXT NOT NULL,
      limit_amount REAL NOT NULL,
      month_key TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_state TEXT NOT NULL,
      record_source TEXT NOT NULL,
      revision INTEGER NOT NULL,
      deleted_at TEXT,
      PRIMARY KEY (user_id, id)
    );`,
    `CREATE TABLE IF NOT EXISTS incomes (
      user_id TEXT NOT NULL,
      id TEXT NOT NULL,
      source TEXT NOT NULL,
      amount REAL NOT NULL,
      date INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_state TEXT NOT NULL,
      record_source TEXT NOT NULL,
      revision INTEGER NOT NULL,
      deleted_at TEXT,
      PRIMARY KEY (user_id, id)
    );`,
    `CREATE TABLE IF NOT EXISTS recurring_rules (
      user_id TEXT NOT NULL,
      id TEXT NOT NULL,
      label TEXT NOT NULL,
      kind TEXT NOT NULL,
      interval TEXT NOT NULL,
      next_run_at INTEGER NOT NULL,
      amount REAL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_state TEXT NOT NULL,
      record_source TEXT NOT NULL,
      revision INTEGER NOT NULL,
      deleted_at TEXT,
      PRIMARY KEY (user_id, id)
    );`,
    `CREATE TABLE IF NOT EXISTS sync_jobs (
      user_id TEXT NOT NULL,
      id TEXT NOT NULL,
      job_type TEXT NOT NULL,
      trigger TEXT NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      payload TEXT,
      last_error TEXT,
      queued_at TEXT NOT NULL,
      run_after TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, id)
    );`,
    `CREATE TABLE IF NOT EXISTS sync_runtime (
      user_id TEXT NOT NULL,
      consecutive_failures INTEGER NOT NULL DEFAULT 0,
      circuit_open_until TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id)
    );`,
    `CREATE TABLE IF NOT EXISTS import_audit (
      user_id TEXT NOT NULL,
      id TEXT NOT NULL,
      source TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      payload TEXT,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, id)
    );`,
    `CREATE TABLE IF NOT EXISTS merchant_categories (
      user_id TEXT NOT NULL,
      id TEXT NOT NULL,
      merchant TEXT NOT NULL,
      category TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_state TEXT NOT NULL,
      record_source TEXT NOT NULL,
      revision INTEGER NOT NULL,
      deleted_at TEXT,
      PRIMARY KEY (user_id, id),
      UNIQUE (user_id, merchant)
    );`,
    `CREATE TABLE IF NOT EXISTS assistant_conversations (
      user_id TEXT NOT NULL,
      id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      PRIMARY KEY (user_id, id)
    );`,
    `CREATE TABLE IF NOT EXISTS assistant_messages (
      user_id TEXT NOT NULL,
      id TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      action_type TEXT,
      action_payload TEXT,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, id)
    );`,
    `CREATE TABLE IF NOT EXISTS insight_cards (
      user_id TEXT NOT NULL,
      id TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 0,
      dismissed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      expires_at TEXT,
      PRIMARY KEY (user_id, id)
    );`,
    `CREATE TABLE IF NOT EXISTS review_snapshots (
      user_id TEXT NOT NULL,
      id TEXT NOT NULL,
      period TEXT NOT NULL,
      period_key TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, id)
    );`,
    `CREATE TABLE IF NOT EXISTS app_update_info (
      user_id TEXT NOT NULL,
      version_code INTEGER NOT NULL,
      version_name TEXT NOT NULL,
      download_url TEXT NOT NULL,
      checksum_sha256 TEXT NOT NULL,
      required INTEGER NOT NULL DEFAULT 0,
      release_notes TEXT NOT NULL DEFAULT '',
      fetched_at TEXT NOT NULL,
      PRIMARY KEY (user_id)
    );`,
    `CREATE TABLE IF NOT EXISTS export_history (
      user_id TEXT NOT NULL,
      id TEXT NOT NULL,
      filename TEXT NOT NULL,
      record_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, id)
    );`,
    `CREATE TABLE IF NOT EXISTS fuliza_loans (
      user_id TEXT NOT NULL,
      id TEXT NOT NULL,
      outstanding_amount REAL NOT NULL DEFAULT 0,
      limit_amount REAL NOT NULL DEFAULT 0,
      last_charge_date INTEGER,
      last_repayment_date INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_state TEXT NOT NULL,
      record_source TEXT NOT NULL,
      revision INTEGER NOT NULL,
      deleted_at TEXT,
      PRIMARY KEY (user_id, id)
    );`,
    `CREATE TABLE IF NOT EXISTS paybill_registry (
      user_id TEXT NOT NULL,
      id TEXT NOT NULL,
      paybill_number TEXT NOT NULL,
      label TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Bills',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, id),
      UNIQUE (user_id, paybill_number)
    );`,
    `CREATE TABLE IF NOT EXISTS feature_flags (
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, key)
    );`,
    'CREATE INDEX IF NOT EXISTS idx_tx_user_id ON transactions(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(user_id, date);',
    'CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(user_id, category);',
    'CREATE INDEX IF NOT EXISTS idx_tx_merchant ON transactions(user_id, merchant);',
    'CREATE INDEX IF NOT EXISTS idx_tx_mpesa_code ON transactions(user_id, mpesa_code);',
    'CREATE INDEX IF NOT EXISTS idx_tx_source_hash ON transactions(user_id, source_hash);',
    'CREATE INDEX IF NOT EXISTS idx_tx_semantic_hash ON transactions(user_id, semantic_hash);',
    'CREATE INDEX IF NOT EXISTS idx_tx_sync_state ON transactions(user_id, sync_state);',
    'CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(user_id, deadline);',
    'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(user_id, status);',
    'CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(user_id, priority);',
    'CREATE INDEX IF NOT EXISTS idx_tasks_sync_state ON tasks(user_id, sync_state);',
    'CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_events_date ON events(user_id, date);',
    'CREATE INDEX IF NOT EXISTS idx_events_sync_state ON events(user_id, sync_state);',
    'CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_budgets_category ON budgets(user_id, category);',
    'CREATE INDEX IF NOT EXISTS idx_budgets_month_key ON budgets(user_id, month_key);',
    'CREATE INDEX IF NOT EXISTS idx_incomes_user_id ON incomes(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_incomes_date ON incomes(user_id, date);',
    'CREATE INDEX IF NOT EXISTS idx_recurring_user_id ON recurring_rules(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_recurring_next_run_at ON recurring_rules(user_id, next_run_at);',
    'CREATE INDEX IF NOT EXISTS idx_sync_jobs_user_status ON sync_jobs(user_id, status);',
    'CREATE INDEX IF NOT EXISTS idx_import_audit_user_id ON import_audit(user_id, created_at);',
    'CREATE INDEX IF NOT EXISTS idx_asst_msg_conversation ON assistant_messages(user_id, conversation_id);',
    'CREATE INDEX IF NOT EXISTS idx_merchant_cat_user ON merchant_categories(user_id);',
    `DELETE FROM sync_jobs WHERE status IN ('SYNCED','TOMBSTONED') AND updated_at < datetime('now', '-30 days');`,
    `DELETE FROM import_audit WHERE created_at < datetime('now', '-30 days');`,
    'DROP VIEW IF EXISTS DailySpendView;',
    `CREATE VIEW IF NOT EXISTS DailySpendView AS
      SELECT user_id, date(date / 1000, 'unixepoch') as day, SUM(amount) as total
      FROM transactions
      WHERE amount > 0 AND transaction_type NOT IN ('RECEIVED','DEPOSIT')
      GROUP BY user_id, day;`,
    'DROP VIEW IF EXISTS MonthlySpendView;',
    `CREATE VIEW IF NOT EXISTS MonthlySpendView AS
      SELECT user_id, strftime('%Y-%m', date / 1000, 'unixepoch') as month, SUM(amount) as total
      FROM transactions
      WHERE amount > 0 AND transaction_type NOT IN ('RECEIVED','DEPOSIT')
      GROUP BY user_id, month;`,
  ],
  2: [
    'ALTER TABLE merchant_categories ADD COLUMN user_corrected INTEGER NOT NULL DEFAULT 0;',
    'ALTER TABLE fuliza_loans ADD COLUMN available_amount REAL;',
    'ALTER TABLE import_audit ADD COLUMN mpesa_code TEXT;',
    'ALTER TABLE import_audit ADD COLUMN amount REAL;',
    'ALTER TABLE import_audit ADD COLUMN amount_band TEXT;',
  ],
  3: [
    'ALTER TABLE transactions ADD COLUMN balance REAL;',
  ],
  4: [
    'ALTER TABLE fuliza_loans RENAME COLUMN outstanding_amount TO legacy_outstanding_amount;',
    'ALTER TABLE fuliza_loans ADD COLUMN draw_code TEXT NOT NULL DEFAULT "";',
    'ALTER TABLE fuliza_loans ADD COLUMN draw_amount_kes REAL NOT NULL DEFAULT 0;',
    'ALTER TABLE fuliza_loans ADD COLUMN total_repaid_kes REAL NOT NULL DEFAULT 0;',
    'ALTER TABLE fuliza_loans ADD COLUMN status TEXT NOT NULL DEFAULT "OPEN";',
    'ALTER TABLE fuliza_loans ADD COLUMN draw_date INTEGER;',
    'ALTER TABLE fuliza_loans ADD COLUMN last_repayment_date INTEGER;',
    'CREATE INDEX IF NOT EXISTS idx_fuliza_draw_code ON fuliza_loans(user_id, draw_code);',
    'CREATE INDEX IF NOT EXISTS idx_fuliza_status ON fuliza_loans(user_id, status);',
    `UPDATE fuliza_loans SET draw_code = "pre_migration", draw_amount_kes = legacy_outstanding_amount, draw_date = last_charge_date WHERE draw_code = "" OR draw_code IS NULL;`,
    `UPDATE fuliza_loans SET status = CASE WHEN total_repaid_kes >= draw_amount_kes THEN "CLOSED" WHEN total_repaid_kes > 0 THEN "PARTIALLY_REPAID" ELSE "OPEN" END WHERE draw_code = "pre_migration";`,
  ],
  5: [
    'ALTER TABLE insight_cards ADD COLUMN refreshed_at TEXT;',
    'ALTER TABLE insight_cards ADD COLUMN stale_after_hours INTEGER;',
  ],
  6: [
    'ALTER TABLE transactions ADD COLUMN transaction_cost REAL;',
  ],
  7: [
    'CREATE INDEX IF NOT EXISTS idx_tx_transaction_type ON transactions(user_id, transaction_type);',
  ],
};

export async function getDbVersion(): Promise<number> {
  const db = await getDatabase();
  await db.execAsync(`CREATE TABLE IF NOT EXISTS db_version (version INTEGER NOT NULL);`);
  const row = await db.getFirstAsync<{ version: number }>('SELECT version FROM db_version LIMIT 1');
  return row?.version ?? 0;
}

export async function setDbVersion(version: number): Promise<void> {
  const db = await getDatabase();
  await db.execAsync('DELETE FROM db_version;');
  await db.runAsync('INSERT INTO db_version (version) VALUES (?);', version);
}

export async function runDatabaseMigrations() {
  const db = await getDatabase();
  await db.execAsync('PRAGMA journal_mode = WAL;');

  let currentVersion = await getDbVersion();

  if (currentVersion === 0) {
    for (const stmt of MIGRATIONS[1]) {
      await db.execAsync(stmt);
    }
    await setDbVersion(1);
    currentVersion = 1;
  }

  for (let v = currentVersion + 1; v <= CURRENT_VERSION; v++) {
    const stmts = MIGRATIONS[v];
    if (!stmts) continue;
    for (const stmt of stmts) {
      await db.execAsync(stmt);
    }
    await setDbVersion(v);
  }
}

export async function seedDatabase(userId: string) {
  const db = await getDatabase();
  const existingTx = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM transactions WHERE user_id = ?',
    userId,
  );

  if ((existingTx?.count ?? 0) > 0) return;

  const now = Date.now();
  const createdAt = new Date().toISOString();
  const txSeed = [
    { id: 'tx_1', amount: 4.5, merchant: 'Artisan Coffee', category: 'Food', type: 'PAID' },
    { id: 'tx_2', amount: -3200, merchant: 'Salary Deposit', category: 'Income', type: 'RECEIVED' },
    { id: 'tx_3', amount: 82.1, merchant: 'Groceries HQ', category: 'Food', type: 'BUY_GOODS' },
    { id: 'tx_4', amount: 85, merchant: 'Transport Hub', category: 'Transport', type: 'PAID' },
  ] as const;

  for (const tx of txSeed) {
    await db.runAsync(
      `INSERT INTO transactions (
        user_id,id,amount,merchant,category,date,source,transaction_type,
        mpesa_code,source_hash,semantic_hash,raw_sms,inferred_category,inference_source,
        created_at,updated_at,sync_state,record_source,revision,deleted_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      userId,
      tx.id,
      Math.abs(tx.amount),
      tx.merchant,
      tx.category,
      now,
      tx.amount < 0 ? 'Bank' : 'MPESA',
      tx.type,
      null,
      null,
      null,
      null,
      null,
      null,
      createdAt,
      createdAt,
      'SYNCED',
      'SEED',
      1,
      null,
    );
  }

  const taskSeed = [
    { id: 'task_1', title: 'Finalize Q3 Board Deck', priority: 'CRITICAL', status: 'PENDING', subtitleOffset: 2 },
    { id: 'task_2', title: 'Review legal contracts for M&A', priority: 'CRITICAL', status: 'PENDING', subtitleOffset: -2 },
    { id: 'task_3', title: 'Prep materials for weekly sync', priority: 'MEDIUM', status: 'PENDING', subtitleOffset: 20 },
  ] as const;

  for (const task of taskSeed) {
    const deadline = now + task.subtitleOffset * 60 * 60 * 1000;
    await db.runAsync(
      `INSERT INTO tasks (
        user_id,id,title,description,priority,deadline,status,completed_at,reminder_offsets,alarm_enabled,
        created_at,updated_at,sync_state,record_source,revision,deleted_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      userId,
      task.id,
      task.title,
      '',
      task.priority,
      deadline,
      task.status,
      null,
      '15,60',
      1,
      createdAt,
      createdAt,
      'SYNCED',
      'SEED',
      1,
      null,
    );
  }

  await db.runAsync(
    `INSERT INTO events (
      user_id,id,title,description,date,end_date,type,importance,status,has_reminder,reminder_minutes_before,kind,
      all_day,repeat_rule,reminder_offsets,alarm_enabled,guests,time_zone_id,reminder_time_of_day_minutes,
      created_at,updated_at,sync_state,record_source,revision,deleted_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    userId,
    'event_1',
    'Product Sync',
    '',
    now + 24 * 60 * 60 * 1000,
    now + 25 * 60 * 60 * 1000,
    'WORK',
    'IMPORTANT',
    'PENDING',
    1,
    15,
    'EVENT',
    0,
    'WEEKLY',
    '15,60',
    1,
    '',
    'Africa/Nairobi',
    480,
    createdAt,
    createdAt,
    'SYNCED',
    'SEED',
    1,
    null,
  );

  await db.runAsync(
    `INSERT INTO budgets (user_id,id,category,limit_amount,month_key,created_at,updated_at,sync_state,record_source,revision,deleted_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    userId,
    'budget_food',
    'Food',
    400,
    new Date().toISOString().slice(0, 7),
    createdAt,
    createdAt,
    'SYNCED',
    'SEED',
    1,
    null,
  );

  await db.runAsync(
    `INSERT INTO incomes (user_id,id,source,amount,date,note,created_at,updated_at,sync_state,record_source,revision,deleted_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    userId,
    'income_salary',
    'Salary',
    3200,
    now - 24 * 60 * 60 * 1000,
    'Monthly salary',
    createdAt,
    createdAt,
    'SYNCED',
    'SEED',
    1,
    null,
  );

  await db.runAsync(
    `INSERT INTO recurring_rules (user_id,id,label,kind,interval,next_run_at,amount,active,created_at,updated_at,sync_state,record_source,revision,deleted_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    userId,
    'recurring_water',
    'Water bill',
    'EXPENSE',
    'MONTHLY',
    now + 7 * 24 * 60 * 60 * 1000,
    30,
    1,
    createdAt,
    createdAt,
    'SYNCED',
    'SEED',
    1,
    null,
  );
}