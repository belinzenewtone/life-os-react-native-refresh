/**
 * Database Encryption Manager
 *
 * Derives and manages the SQLCipher encryption key for the local SQLite database.
 * The key is randomly generated on first launch and persisted in expo-secure-store.
 * SQLCipher is enabled at build time via the expo-sqlite plugin config.
 *
 * Key lifecycle:
 *   1. On first open, generate a random 256-bit key
 *   2. Store it in SecureStore (backed by Keychain/Keystore)
 *   3. Apply it via PRAGMA key on every database open
 *   4. Rotation: generate new key, re-encrypt database, store new key
 */

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const DB_KEY_STORE_KEY = 'lifeos.db_encryption_key_v1';
const KEY_LENGTH_BYTES = 32; // 256 bits

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function generateRandomKey(): Promise<string> {
  const randomBytes = Crypto.getRandomBytes(KEY_LENGTH_BYTES);
  return bytesToHex(randomBytes);
}

export class DatabaseEncryptionManager {
  /**
   * Retrieves the current database encryption key, generating one if absent.
   * The key is stored in the device's secure enclave (Keychain/Keystore).
   */
  static async getOrCreateKey(): Promise<string> {
    const existing = await SecureStore.getItemAsync(DB_KEY_STORE_KEY);
    if (existing) return existing;

    const freshKey = await generateRandomKey();
    await SecureStore.setItemAsync(DB_KEY_STORE_KEY, freshKey);
    return freshKey;
  }

  /**
   * Returns the stored key without generating a new one.
   * Returns null if no key has been created yet.
   */
  static async getKey(): Promise<string | null> {
    return SecureStore.getItemAsync(DB_KEY_STORE_KEY);
  }

  /**
   * Rotates the encryption key:
   *   1. Retrieves the current key
   *   2. Generates a new random key
   *   3. Uses SQLCipher's rekey PRAGMA to re-encrypt the database
   *   4. Stores the new key securely
   *
   * Must be called while the database is open and already unlocked.
   */
  static async rotateKey(db: { execAsync: (sql: string) => Promise<void> }): Promise<string> {
    const newKey = await generateRandomKey();
    // SQLCipher rekey: changes the encryption key in-place
    await db.execAsync(`PRAGMA rekey = "x'${newKey}'"`);
    await SecureStore.setItemAsync(DB_KEY_STORE_KEY, newKey);
    return newKey;
  }

  /**
   * Applies the encryption key to an open database connection.
   * Must be called immediately after openDatabaseAsync and before any other queries.
   */
  static async applyKey(db: { execAsync: (sql: string) => Promise<void> }): Promise<void> {
    const key = await this.getOrCreateKey();
    await db.execAsync(`PRAGMA key = "x'${key}'"`);
  }

  /**
   * Clears the stored encryption key. Use with caution — this will
   * render the database unreadable on next launch unless a backup key exists.
   */
  static async clearKey(): Promise<void> {
    await SecureStore.deleteItemAsync(DB_KEY_STORE_KEY);
  }
}
