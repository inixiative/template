import { describe, expect, it, beforeEach } from 'vitest';
import { EncryptionService } from '@template/db/lib/encryption/encryptionService';
import type { EncryptionKeyring } from '@template/db/lib/encryption/types';

describe('EncryptionService', () => {
  const testKey1Base64 = Buffer.from('12345678901234567890123456789012', 'utf8').toString('base64');
  const testKey2Base64 = Buffer.from('abcdefghijklmnopqrstuvwxyz123456', 'utf8').toString('base64');

  let service: EncryptionService;
  let keyring: EncryptionKeyring;

  beforeEach(() => {
    keyring = {
      currentVersion: 1,
      currentKey: testKey1Base64,
    };
    service = new EncryptionService(keyring);
  });

  describe('constructor validation', () => {
    it('creates service with valid keyring', () => {
      expect(() => new EncryptionService(keyring)).not.toThrow();
    });

    it('rejects keyring with invalid current key length', () => {
      const shortKey = Buffer.from('short', 'utf8').toString('base64');
      expect(() => new EncryptionService({ currentVersion: 1, currentKey: shortKey })).toThrow('Key must be exactly 32 bytes');
    });

    it('rejects keyring with invalid previous key length', () => {
      const shortKey = Buffer.from('short', 'utf8').toString('base64');
      expect(
        () =>
          new EncryptionService({
            currentVersion: 2,
            currentKey: testKey1Base64,
            previousVersion: 1,
            previousKey: shortKey,
          }),
      ).toThrow('Previous key must be exactly 32 bytes');
    });
  });

  describe('encrypt', () => {
    it('encrypts string data', async () => {
      const result = await service.encrypt('sensitive-data', 'aad-context');

      expect(result).toHaveProperty('ciphertext');
      expect(result).toHaveProperty('version', 1);
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('authTag');
      expect(typeof result.ciphertext).toBe('string');
      expect(typeof result.iv).toBe('string');
      expect(typeof result.authTag).toBe('string');
    });

    it('encrypts object data', async () => {
      const data = { clientId: 'id', clientSecret: 'secret' };
      const result = await service.encrypt(data, 'aad-context');

      expect(result.version).toBe(1);
      expect(result.ciphertext).toBeDefined();
    });

    it('produces different ciphertext for same plaintext (random IV)', async () => {
      const result1 = await service.encrypt('same-data', 'aad');
      const result2 = await service.encrypt('same-data', 'aad');

      expect(result1.ciphertext).not.toBe(result2.ciphertext);
      expect(result1.iv).not.toBe(result2.iv);
    });

    it('throws on null plaintext', async () => {
      await expect(service.encrypt(null as any, 'aad')).rejects.toThrow('Plaintext cannot be null or undefined');
    });

    it('throws on undefined plaintext', async () => {
      await expect(service.encrypt(undefined as any, 'aad')).rejects.toThrow('Plaintext cannot be null or undefined');
    });

    it('throws on empty string plaintext', async () => {
      await expect(service.encrypt('', 'aad')).rejects.toThrow('Plaintext cannot be empty');
    });
  });

  describe('decrypt', () => {
    it('decrypts data encrypted with current key', async () => {
      const plaintext = 'secret-data';
      const encrypted = await service.encrypt(plaintext, 'aad');
      const decrypted = await service.decrypt(encrypted, 'aad');

      expect(decrypted).toBe(plaintext);
    });

    it('decrypts object data', async () => {
      const data = { clientId: 'id', clientSecret: 'secret' };
      const encrypted = await service.encrypt(data, 'aad');
      const decrypted = await service.decrypt(encrypted, 'aad');

      expect(decrypted).toEqual(data);
    });

    it('decrypts data encrypted with previous key', async () => {
      const oldService = new EncryptionService({ currentVersion: 1, currentKey: testKey2Base64 });
      const encrypted = await oldService.encrypt('old-data', 'aad');

      const newService = new EncryptionService({
        currentVersion: 2,
        currentKey: testKey1Base64,
        previousVersion: 1,
        previousKey: testKey2Base64,
      });
      const decrypted = await newService.decrypt(encrypted, 'aad');

      expect(decrypted).toBe('old-data');
    });

    it('throws on tampered ciphertext', async () => {
      const encrypted = await service.encrypt('data', 'aad');
      const tampered = { ...encrypted, ciphertext: 'AAAAAAAAAA' };

      await expect(service.decrypt(tampered, 'aad')).rejects.toThrow('Decryption failed');
    });

    it('throws on wrong AAD', async () => {
      const encrypted = await service.encrypt('data', 'correct-aad');
      await expect(service.decrypt(encrypted, 'wrong-aad')).rejects.toThrow('Decryption failed');
    });

    it('throws when no keys can decrypt', async () => {
      const encrypted = await service.encrypt('data', 'aad');

      const otherService = new EncryptionService({
        currentVersion: 1,
        currentKey: testKey2Base64,
      });

      await expect(otherService.decrypt(encrypted, 'aad')).rejects.toThrow('Decryption failed with all available keys');
    });
  });

  describe('key rotation', () => {
    it('always encrypts with current key version', async () => {
      const serviceV2 = new EncryptionService({
        currentVersion: 2,
        currentKey: testKey1Base64,
        previousVersion: 1,
        previousKey: testKey2Base64,
      });

      const encrypted = await serviceV2.encrypt('data', 'aad');
      expect(encrypted.version).toBe(2);
    });

    it('supports multiple version transitions', async () => {
      const v1Service = new EncryptionService({ currentVersion: 1, currentKey: testKey2Base64 });
      const encryptedV1 = await v1Service.encrypt('data', 'aad');

      const v2Service = new EncryptionService({
        currentVersion: 2,
        currentKey: testKey1Base64,
        previousVersion: 1,
        previousKey: testKey2Base64,
      });

      const decrypted = await v2Service.decrypt(encryptedV1, 'aad');
      expect(decrypted).toBe('data');

      const reEncrypted = await v2Service.encrypt('data', 'aad');
      expect(reEncrypted.version).toBe(2);
    });
  });
});
