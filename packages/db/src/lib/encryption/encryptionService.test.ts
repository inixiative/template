import { beforeEach, describe, expect, it } from 'bun:test';
import { createEncryption, type Encryption } from '@template/db/lib/encryption/encryptionService';
import type { EncryptionKeyring } from '@template/db/lib/encryption/types';

describe('createEncryption', () => {
  const testKey1Base64 = Buffer.from('12345678901234567890123456789012', 'utf8').toString('base64');
  const testKey2Base64 = Buffer.from('abcdefghijklmnopqrstuvwxyz123456', 'utf8').toString('base64');

  let service: Encryption;
  let keyring: EncryptionKeyring;

  beforeEach(() => {
    keyring = { currentVersion: 1, currentKey: testKey1Base64 };
    service = createEncryption(keyring);
  });

  describe('keyring validation', () => {
    it('accepts valid keyring', () => {
      expect(() => createEncryption(keyring)).not.toThrow();
    });

    it('rejects invalid current key length', () => {
      const shortKey = Buffer.from('short', 'utf8').toString('base64');
      expect(() => createEncryption({ currentVersion: 1, currentKey: shortKey })).toThrow(
        'Current key must be exactly 32 bytes',
      );
    });

    it('rejects invalid previous key length', () => {
      const shortKey = Buffer.from('short', 'utf8').toString('base64');
      expect(() =>
        createEncryption({
          currentVersion: 2,
          currentKey: testKey1Base64,
          previousVersion: 1,
          previousKey: shortKey,
        }),
      ).toThrow('Previous key must be exactly 32 bytes');
    });
  });

  describe('encrypt', () => {
    it('encrypts string data', () => {
      const result = service.encrypt('sensitive-data', 'aad-context');
      expect(result.version).toBe(1);
      expect(typeof result.ciphertext).toBe('string');
      expect(typeof result.iv).toBe('string');
      expect(typeof result.authTag).toBe('string');
    });

    it('encrypts object data', () => {
      const result = service.encrypt({ clientId: 'id', clientSecret: 'secret' }, 'aad-context');
      expect(result.version).toBe(1);
      expect(result.ciphertext).toBeDefined();
    });

    it('produces different ciphertext for same plaintext (random IV)', () => {
      const a = service.encrypt('same-data', 'aad');
      const b = service.encrypt('same-data', 'aad');
      expect(a.ciphertext).not.toBe(b.ciphertext);
      expect(a.iv).not.toBe(b.iv);
    });
  });

  describe('decrypt', () => {
    it('round-trips string', () => {
      const encrypted = service.encrypt('secret-data', 'aad');
      expect(service.decrypt(encrypted, 'aad')).toBe('secret-data');
    });

    it('round-trips object', () => {
      const data = { clientId: 'id', clientSecret: 'secret' };
      const encrypted = service.encrypt(data, 'aad');
      expect(service.decrypt(encrypted, 'aad')).toEqual(data);
    });

    it('decrypts data encrypted with previous key', () => {
      const old = createEncryption({ currentVersion: 1, currentKey: testKey2Base64 });
      const encrypted = old.encrypt('old-data', 'aad');

      const next = createEncryption({
        currentVersion: 2,
        currentKey: testKey1Base64,
        previousVersion: 1,
        previousKey: testKey2Base64,
      });
      expect(next.decrypt(encrypted, 'aad')).toBe('old-data');
    });

    it('throws on tampered ciphertext', () => {
      const encrypted = service.encrypt('data', 'aad');
      expect(() => service.decrypt({ ...encrypted, ciphertext: 'AAAAAAAAAA' }, 'aad')).toThrow();
    });

    it('throws on wrong AAD', () => {
      const encrypted = service.encrypt('data', 'correct-aad');
      expect(() => service.decrypt(encrypted, 'wrong-aad')).toThrow();
    });

    it('throws when no keys can decrypt', () => {
      const encrypted = service.encrypt('data', 'aad');
      const other = createEncryption({ currentVersion: 1, currentKey: testKey2Base64 });
      expect(() => other.decrypt(encrypted, 'aad')).toThrow();
    });
  });

  describe('key rotation', () => {
    it('always encrypts with current key version', () => {
      const v2 = createEncryption({
        currentVersion: 2,
        currentKey: testKey1Base64,
        previousVersion: 1,
        previousKey: testKey2Base64,
      });
      expect(v2.encrypt('data', 'aad').version).toBe(2);
    });

    it('supports multiple version transitions', () => {
      const v1 = createEncryption({ currentVersion: 1, currentKey: testKey2Base64 });
      const encryptedV1 = v1.encrypt('data', 'aad');

      const v2 = createEncryption({
        currentVersion: 2,
        currentKey: testKey1Base64,
        previousVersion: 1,
        previousKey: testKey2Base64,
      });
      expect(v2.decrypt(encryptedV1, 'aad')).toBe('data');
      expect(v2.encrypt('data', 'aad').version).toBe(2);
    });
  });
});
