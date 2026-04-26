import { SQLiteDatabase, openDatabaseAsync } from 'expo-sqlite';
import { DatabaseEncryptionManager } from '@/core/security/database-encryption-manager';

let database: SQLiteDatabase | null = null;

export async function getDatabase() {
  if (!database) {
    database = await openDatabaseAsync('lifeos.db');
    await DatabaseEncryptionManager.applyKey(database);
  }
  return database;
}