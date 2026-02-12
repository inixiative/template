import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { cleanupTouchedTables, createAuthProvider, registerTestTracker } from '@template/db/test';
import { db } from '@template/db';
import { validateEncryptionVersions } from '@template/db/lib/encryption/validation';

describe('validateEncryptionVersions', () => {
  const testKey1Base64 = Buffer.from('12345678901234567890123456789012', 'utf8').toString('base64');
  const testKey2Base64 = Buffer.from('abcdefghijklmnopqrstuvwxyz123456', 'utf8').toString('base64');

  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    registerTestTracker();
    originalEnv = { ...process.env };
  });

  beforeEach(() => {
    process.env.AUTH_PROVIDER_SECRETS_ENCRYPTION_VERSION = '1';
    process.env.AUTH_PROVIDER_SECRETS_ENCRYPTION_KEY_CURRENT = testKey1Base64;
    delete process.env.AUTH_PROVIDER_SECRETS_ENCRYPTION_KEY_PREVIOUS;
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  afterAll(async () => {
    process.env = originalEnv;
  });

  describe('env var validation', () => {
    it('requires previous key when version > 1', async () => {
      process.env.AUTH_PROVIDER_SECRETS_ENCRYPTION_VERSION = '2';
      delete process.env.AUTH_PROVIDER_SECRETS_ENCRYPTION_KEY_PREVIOUS;

      const result = await validateEncryptionVersions(db);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Previous key required when version > 1');
    });

    it('accepts version 1 without previous key', async () => {
      const result = await validateEncryptionVersions(db);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('version validation rules', () => {
    it('passes when no encrypted data exists', async () => {
      const result = await validateEncryptionVersions(db);
      expect(result.valid).toBe(true);
    });

    it('detects version downgrade (env < DB max)', async () => {
      await createAuthProvider({ encryptedSecretsKeyVersion: 2 });

      process.env.AUTH_PROVIDER_SECRETS_ENCRYPTION_VERSION = '1';
      const result = await validateEncryptionVersions(db);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Version downgrade detected');
      expect(result.errors[0]).toContain('Env version 1 < DB max version 2');
    });

    it('detects version jump too large', async () => {
      await createAuthProvider({ encryptedSecretsKeyVersion: 1 });

      process.env.AUTH_PROVIDER_SECRETS_ENCRYPTION_VERSION = '3';
      process.env.AUTH_PROVIDER_SECRETS_ENCRYPTION_KEY_PREVIOUS = testKey2Base64;

      const result = await validateEncryptionVersions(db);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Version jump too large');
      expect(result.errors[0]).toContain('can only increment by 1');
    });

    it('prevents version bump when not all records on latest', async () => {
      await createAuthProvider({ encryptedSecretsKeyVersion: 1 });
      await createAuthProvider({ encryptedSecretsKeyVersion: 2 });

      process.env.AUTH_PROVIDER_SECRETS_ENCRYPTION_VERSION = '3';
      process.env.AUTH_PROVIDER_SECRETS_ENCRYPTION_KEY_PREVIOUS = testKey2Base64;

      const result = await validateEncryptionVersions(db);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Cannot bump version');
      expect(result.errors[0]).toContain('All records must be on version 2');
    });

    it('detects too many versions (>2)', async () => {
      await createAuthProvider({ encryptedSecretsKeyVersion: 1 });
      await createAuthProvider({ encryptedSecretsKeyVersion: 2 });
      await createAuthProvider({ encryptedSecretsKeyVersion: 3 });

      process.env.AUTH_PROVIDER_SECRETS_ENCRYPTION_VERSION = '3';
      process.env.AUTH_PROVIDER_SECRETS_ENCRYPTION_KEY_PREVIOUS = testKey2Base64;

      const result = await validateEncryptionVersions(db);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Too many versions'))).toBe(true);
    });

    it('allows version increment by 1', async () => {
      await createAuthProvider({ encryptedSecretsKeyVersion: 1 });

      process.env.AUTH_PROVIDER_SECRETS_ENCRYPTION_VERSION = '2';
      process.env.AUTH_PROVIDER_SECRETS_ENCRYPTION_KEY_PREVIOUS = testKey2Base64;

      const result = await validateEncryptionVersions(db);
      expect(result.valid).toBe(true);
    });

    it('allows 2 versions during migration', async () => {
      await createAuthProvider({ encryptedSecretsKeyVersion: 1 });
      await createAuthProvider({ encryptedSecretsKeyVersion: 2 });

      process.env.AUTH_PROVIDER_SECRETS_ENCRYPTION_VERSION = '2';
      process.env.AUTH_PROVIDER_SECRETS_ENCRYPTION_KEY_PREVIOUS = testKey2Base64;

      const result = await validateEncryptionVersions(db);
      expect(result.valid).toBe(true);
    });
  });
});
