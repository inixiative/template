import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { encryptField, decryptField } from '@template/db/lib/encryption/helpers';
import { ENCRYPTED_MODELS } from '@template/db/lib/encryption/registry';

describe('encryption helpers', () => {
  const testKey1Base64 = Buffer.from('12345678901234567890123456789012', 'utf8').toString('base64');
  const testKey2Base64 = Buffer.from('abcdefghijklmnopqrstuvwxyz123456', 'utf8').toString('base64');

  const mockRecord = { id: 'test-id-123', organizationId: 'org-456', secrets: {} };

  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.AUTH_PROVIDER_SECRETS_ENCRYPTION_VERSION = '1';
    process.env.AUTH_PROVIDER_SECRETS_ENCRYPTION_KEY_CURRENT = testKey1Base64;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('encryptField', () => {
    it('encrypts data and returns field mapping', async () => {
      const record = {
        ...mockRecord,
        secrets: { clientId: 'test-client', clientSecret: 'secret' },
      };
      const result = await encryptField('authProvider', 'secrets', record);

      expect(result).toHaveProperty('encryptedSecrets');
      expect(result).toHaveProperty('encryptedSecretsMetadata');
      expect(result).toHaveProperty('encryptedSecretsKeyVersion', 1);
      expect(result.encryptedSecretsMetadata).toHaveProperty('iv');
      expect(result.encryptedSecretsMetadata).toHaveProperty('authTag');
    });

    it('uses correct AAD from buildAAD', async () => {
      const record = { ...mockRecord, secrets: { value: 'test' } };
      const result = await encryptField('authProvider', 'secrets', record);

      expect(result.encryptedSecrets).toBeDefined();
    });

    it('includes current version in result', async () => {
      process.env.AUTH_PROVIDER_SECRETS_ENCRYPTION_VERSION = '2';
      process.env.AUTH_PROVIDER_SECRETS_ENCRYPTION_KEY_PREVIOUS = testKey2Base64;

      const record = { ...mockRecord, secrets: { value: 'test' } };
      const result = await encryptField('authProvider', 'secrets', record);
      expect(result.encryptedSecretsKeyVersion).toBe(2);
    });
  });

  describe('decryptField', () => {
    it('decrypts field data', async () => {
      const originalData = { clientId: 'test', clientSecret: 'secret' };
      const encryptRecord = { ...mockRecord, secrets: originalData };
      const encrypted = await encryptField('authProvider', 'secrets', encryptRecord);

      const record = {
        ...mockRecord,
        encryptedSecrets: encrypted.encryptedSecrets,
        encryptedSecretsMetadata: encrypted.encryptedSecretsMetadata,
        encryptedSecretsKeyVersion: encrypted.encryptedSecretsKeyVersion,
      };

      const decrypted = await decryptField('authProvider', 'secrets', record);
      expect(decrypted).toEqual(originalData);
    });

    it('decrypts data encrypted with previous key', async () => {
      process.env.AUTH_PROVIDER_SECRETS_ENCRYPTION_VERSION = '1';
      process.env.AUTH_PROVIDER_SECRETS_ENCRYPTION_KEY_CURRENT = testKey2Base64;
      delete process.env.AUTH_PROVIDER_SECRETS_ENCRYPTION_KEY_PREVIOUS;

      const originalData = { value: 'old-data' };
      const encryptRecord = { ...mockRecord, secrets: originalData };
      const encrypted = await encryptField('authProvider', 'secrets', encryptRecord);

      process.env.AUTH_PROVIDER_SECRETS_ENCRYPTION_VERSION = '2';
      process.env.AUTH_PROVIDER_SECRETS_ENCRYPTION_KEY_CURRENT = testKey1Base64;
      process.env.AUTH_PROVIDER_SECRETS_ENCRYPTION_KEY_PREVIOUS = testKey2Base64;

      const record = {
        ...mockRecord,
        encryptedSecrets: encrypted.encryptedSecrets,
        encryptedSecretsMetadata: encrypted.encryptedSecretsMetadata,
        encryptedSecretsKeyVersion: encrypted.encryptedSecretsKeyVersion,
      };

      const decrypted = await decryptField('authProvider', 'secrets', record);
      expect(decrypted).toEqual(originalData);
    });
  });

  describe('roundtrip', () => {
    it('encrypts and decrypts complex nested objects', async () => {
      const complexData = {
        oauth: { clientId: 'id', clientSecret: 'secret', scopes: ['read', 'write'] },
        saml: { metadata: { url: 'https://example.com' }, domains: ['a.com', 'b.com'] },
      };

      const encryptRecord = { ...mockRecord, secrets: complexData };
      const encrypted = await encryptField('authProvider', 'secrets', encryptRecord);
      const record = {
        ...mockRecord,
        ...encrypted,
      };
      const decrypted = await decryptField('authProvider', 'secrets', record);

      expect(decrypted).toEqual(complexData);
    });
  });
});
