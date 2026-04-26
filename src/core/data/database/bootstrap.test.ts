import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const canonicalColumns = [
  'id',
  'user_id',
  'created_at',
  'updated_at',
  'sync_state',
  'record_source',
  'revision',
  'deleted_at',
];

const bootstrapFilePath = path.resolve(process.cwd(), 'src/core/data/database/bootstrap.ts');
const bootstrapSource = fs.readFileSync(bootstrapFilePath, 'utf8').toLowerCase();

describe('database migrations integrity', () => {
  it('has versioned migration system with db_version table', () => {
    expect(bootstrapSource).toContain('db_version');
    expect(bootstrapSource).toContain('current_version');
  });

  it('migration v2 adds user_corrected, available_amount, and amount_band columns', () => {
    expect(bootstrapSource).toContain('user_corrected');
    expect(bootstrapSource).toContain('available_amount');
    expect(bootstrapSource).toContain('amount_band');
  });

  it('contains all core tables and spend views in v1', () => {
    const requiredTables = [
      'transactions',
      'tasks',
      'events',
      'app_settings',
      'budgets',
      'incomes',
      'recurring_rules',
      'sync_jobs',
      'sync_runtime',
      'import_audit',
      'feature_flags',
    ];

    for (const table of requiredTables) {
      expect(bootstrapSource, `missing table migration for ${table}`).toContain(`create table if not exists ${table}`);
    }

    expect(bootstrapSource).toContain('create view if not exists dailyspendview');
    expect(bootstrapSource).toContain('create view if not exists monthlyspendview');
  });

  it('keeps canonical sync metadata columns on syncable entity tables', () => {
    const syncableTables = ['transactions', 'tasks', 'events', 'budgets', 'incomes', 'recurring_rules'];

    for (const tableName of syncableTables) {
      const sectionStart = bootstrapSource.indexOf(`create table if not exists ${tableName}`);
      expect(sectionStart, `missing create table statement for ${tableName}`).toBeGreaterThanOrEqual(0);
      const lower = bootstrapSource.slice(sectionStart, sectionStart + 2000);
      for (const column of canonicalColumns) {
        expect(lower, `missing ${column} on ${tableName}`).toContain(column);
      }
    }
  });

  it('excludes incoming transfers from spend aggregation views', () => {
    expect(bootstrapSource).toContain("transaction_type not in ('received','deposit')");
  });

  it('has migration path from v1 to current version', () => {
    expect(bootstrapSource).toContain('migrations: record<number, string[]>');
    expect(bootstrapSource).toContain('getdbversion');
    expect(bootstrapSource).toContain('setdbversion');
    expect(bootstrapSource).toContain('rundatabasemigrations');
  });
});