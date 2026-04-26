export const schemaStatements = [
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
    description TEXT NOT NULL,
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
  `CREATE VIEW IF NOT EXISTS DailySpendView AS
    SELECT user_id, date(date / 1000, 'unixepoch') as day, SUM(amount) as total
    FROM transactions
    WHERE amount > 0
    GROUP BY user_id, day;`,
  `CREATE VIEW IF NOT EXISTS MonthlySpendView AS
    SELECT user_id, strftime('%Y-%m', date / 1000, 'unixepoch') as month, SUM(amount) as total
    FROM transactions
    WHERE amount > 0
    GROUP BY user_id, month;`,
];