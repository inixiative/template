import { describe, expect, it } from 'vitest';
import { encryptionKeySchema } from '@template/db/lib/encryption/envValidation';

describe('encryptionKeySchema', () => {
  it('accepts valid base64-encoded 32-byte key', () => {
    const validKey = Buffer.from('12345678901234567890123456789012', 'utf8').toString('base64');
    expect(() => encryptionKeySchema.parse(validKey)).not.toThrow();
  });

  it('rejects key that is not 32 bytes', () => {
    const shortKey = Buffer.from('tooshort', 'utf8').toString('base64');
    expect(() => encryptionKeySchema.parse(shortKey)).toThrow('Encryption key must be valid base64-encoded 32-byte key');
  });

  it('rejects invalid base64', () => {
    const invalidBase64 = 'not-valid-base64!!!';
    expect(() => encryptionKeySchema.parse(invalidBase64)).toThrow();
  });

  it('rejects empty string', () => {
    expect(() => encryptionKeySchema.parse('')).toThrow();
  });
});
