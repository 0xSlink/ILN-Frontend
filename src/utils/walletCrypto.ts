/**
 * Session-scoped encryption for sensitive wallet-scoped data persisted to
 * localStorage (issue #1100: browser wallet data retention).
 *
 * The AES-GCM key lives in sessionStorage only and is regenerated when the
 * session ends (tab close / reload). Encrypted values at rest in localStorage
 * therefore cannot be decrypted outside the session that created them, which
 * bounds the lifetime of retained sensitive data.
 */

const CRYPTO_KEY_STORAGE_KEY = 'iln_wallet_crypto_key';

let keyPromise: Promise<CryptoKey> | null = null;

async function getOrCreateKey(): Promise<CryptoKey> {
  if (keyPromise) return keyPromise;
  keyPromise = (async () => {
    const existing = sessionStorage.getItem(CRYPTO_KEY_STORAGE_KEY);
    let key: CryptoKey;
    if (existing) {
      const raw = base64ToUint8(existing);
      key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, [
        'encrypt',
        'decrypt',
      ]);
    } else {
      key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      const exported = await crypto.subtle.exportKey('raw', key);
      sessionStorage.setItem(CRYPTO_KEY_STORAGE_KEY, uint8ToBase64(exported));
    }
    return key;
  })();
  return keyPromise;
}

function base64ToUint8(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Encrypt a plaintext string to a base64-encoded `iv || ciphertext` blob. */
export async function encryptValue(plaintext: string): Promise<string> {
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return uint8ToBase64(combined);
}

/** Decrypt a base64-encoded `iv || ciphertext` blob. Returns null on failure. */
export async function decryptValue(ciphertext: string): Promise<string | null> {
  try {
    const key = await getOrCreateKey();
    const combined = base64ToUint8(ciphertext);
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}
