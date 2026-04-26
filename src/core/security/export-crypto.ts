/**
 * Export Encryption — AES-256-GCM with PBKDF2 key derivation
 *
 * Replaces the previous XOR-based cipher with proper authenticated encryption.
 * Uses the Web Crypto API (available in React Native Hermes).
 *
 * Format: lifeos-aes-v1:<base64(salt + iv + ciphertext + authTag)>
 *   - salt:   16 bytes (PBKDF2 salt)
 *   - iv:     12 bytes (AES-GCM nonce)
 *   - ciphertext + authTag: variable length
 *
 * Backward compatibility: tryDecryptExport() attempts both AES and legacy XOR.
 */

const AES_VERSION = 'lifeos-aes-v1';
const LEGACY_HEADER = '// ENCRYPTED: lifeos-v1\n';

const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32; // 256 bits
const PBKDF2_ITERATIONS = 100_000;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LEN * 8 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptWithPassphrase(plaintext: string, passphrase: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    enc.encode(plaintext),
  );
  const combined = new Uint8Array(SALT_LEN + IV_LEN + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, SALT_LEN);
  combined.set(new Uint8Array(ciphertext), SALT_LEN + IV_LEN);
  return `${AES_VERSION}:${arrayBufferToBase64(combined.buffer)}`;
}

export async function decryptWithPassphrase(ciphertext: string, passphrase: string): Promise<string | null> {
  try {
    const prefix = `${AES_VERSION}:`;
    if (!ciphertext.startsWith(prefix)) return null;
    const encoded = ciphertext.slice(prefix.length);
    const combined = new Uint8Array(base64ToArrayBuffer(encoded));

    if (combined.length < SALT_LEN + IV_LEN + TAG_LEN) return null;

    const salt = combined.slice(0, SALT_LEN);
    const iv = combined.slice(SALT_LEN, SALT_LEN + IV_LEN);
    const encrypted = combined.slice(SALT_LEN + IV_LEN);

    const key = await deriveKey(passphrase, salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      key,
      encrypted,
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

// ── Legacy XOR decryption (for backward compatibility) ─────────────────────

function legacyDeriveKey(passphrase: string): number[] {
  const key: number[] = [];
  for (let i = 0; i < passphrase.length; i++) {
    key.push(passphrase.charCodeAt(i));
  }
  if (key.length === 0) key.push(0);
  return key;
}

function legacyFromBase64(data: string): number[] {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of data) {
    if (char === '=') break;
    const idx = chars.indexOf(char);
    if (idx < 0) continue;
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return bytes;
}

function legacyUtf8BytesToString(bytes: number[]): string {
  let result = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b < 0x80) {
      result += String.fromCharCode(b);
      i += 1;
    } else if (b < 0xe0) {
      const c = ((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f);
      result += String.fromCharCode(c);
      i += 2;
    } else if (b < 0xf0) {
      const c = ((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f);
      result += String.fromCharCode(c);
      i += 3;
    } else {
      const c = ((b & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
      result += String.fromCodePoint(c);
      i += 4;
    }
  }
  return result;
}

function legacyDecryptWithPassphrase(ciphertext: string, passphrase: string): string | null {
  try {
    const key = legacyDeriveKey(passphrase);
    const bytes = legacyFromBase64(ciphertext);
    const decrypted = bytes.map((byte, i) => byte ^ key[i % key.length]);
    return legacyUtf8BytesToString(decrypted);
  } catch {
    return null;
  }
}

export function tryDecryptLegacyExport(content: string, passphrase: string): string | null {
  if (!content.startsWith(LEGACY_HEADER)) return null;
  try {
    const json = content.slice(LEGACY_HEADER.length);
    const { enc } = JSON.parse(json);
    return legacyDecryptWithPassphrase(enc, passphrase);
  } catch {
    return null;
  }
}
