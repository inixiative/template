import crypto from 'node:crypto';
import type { EncryptedFieldData, EncryptionKeyring } from '@template/db/lib/encryption/types';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;

const validateKey = (key: string, label: string): void => {
  if (Buffer.from(key, 'base64').length !== KEY_LENGTH) {
    throw new Error(`${label} must be exactly 32 bytes`);
  }
};

export const createEncryption = (keyring: EncryptionKeyring) => {
  validateKey(keyring.currentKey, 'Current key');
  if (keyring.previousKey) validateKey(keyring.previousKey, 'Previous key');

  const encrypt = (plaintext: unknown, aad: string): EncryptedFieldData => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(keyring.currentKey, 'base64'), iv);
    cipher.setAAD(Buffer.from(aad, 'utf8'));
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(plaintext), 'utf8'), cipher.final()]);
    return {
      ciphertext: encrypted.toString('base64'),
      version: keyring.currentVersion,
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
    };
  };

  const decrypt = (encrypted: EncryptedFieldData, aad: string): unknown => {
    const key = encrypted.version === keyring.currentVersion ? keyring.currentKey : keyring.previousKey;
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(key!, 'base64'),
      Buffer.from(encrypted.iv, 'base64'),
    );
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(Buffer.from(encrypted.authTag, 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
    return JSON.parse(plaintext);
  };

  return { encrypt, decrypt };
};

export type Encryption = ReturnType<typeof createEncryption>;
