// Password hashing using Web Crypto API
// Simple but secure - uses PBKDF2 with SHA-256

const ITERATIONS = 100000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    KEY_LENGTH * 8,
  );

  const hash = new Uint8Array(derivedBits);

  // Format: iterations:salt:hash (all base64)
  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...hash));

  return `${ITERATIONS}:${saltB64}:${hashB64}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const [iterationsStr, saltB64, hashB64] = storedHash.split(':');
    if (!iterationsStr || !saltB64 || !hashB64) return false;

    const iterations = parseInt(iterationsStr, 10);
    const salt = new Uint8Array(atob(saltB64).split('').map((c) => c.charCodeAt(0)));
    const expectedHash = atob(hashB64);

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits'],
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256',
      },
      key,
      KEY_LENGTH * 8,
    );

    const hash = new Uint8Array(derivedBits);
    const actualHash = String.fromCharCode(...hash);

    return actualHash === expectedHash;
  } catch {
    return false;
  }
}
