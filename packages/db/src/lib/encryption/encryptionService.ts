import crypto from 'node:crypto';
import type { EncryptedFieldData, EncryptionKeyring } from '@template/db/lib/encryption/types';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;

export class EncryptionService {
  private keyring: EncryptionKeyring;

  constructor(keyring: EncryptionKeyring) {
    this.validateKeyring(keyring);
    this.keyring = keyring;
  }

  private validateKeyring(keyring: EncryptionKeyring): void {
    if (!keyring.currentKey || typeof keyring.currentKey !== 'string') {
      throw new Error('Current key is required');
    }

    const currentBuffer = Buffer.from(keyring.currentKey, 'base64');
    if (currentBuffer.length !== KEY_LENGTH) {
      throw new Error('Key must be exactly 32 bytes');
    }

    if (keyring.previousKey) {
      const previousBuffer = Buffer.from(keyring.previousKey, 'base64');
      if (previousBuffer.length !== KEY_LENGTH) {
        throw new Error('Previous key must be exactly 32 bytes');
      }
    }
  }

  async encrypt(plaintext: unknown, aad: string): Promise<EncryptedFieldData> {
    if (plaintext === null || plaintext === undefined) {
      throw new Error('Plaintext cannot be null or undefined');
    }

    const plaintextStr = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);

    if (plaintextStr === '' || plaintextStr === '""') {
      throw new Error('Plaintext cannot be empty');
    }

    if (!aad || typeof aad !== 'string') {
      throw new Error('AAD must be a non-empty string');
    }

    const key = Buffer.from(this.keyring.currentKey, 'base64');
    const iv = crypto.randomBytes(12);
    const aadBuffer = Buffer.from(aad, 'utf8');

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    cipher.setAAD(aadBuffer);

    const encrypted = Buffer.concat([cipher.update(plaintextStr, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      ciphertext: encrypted.toString('base64'),
      version: this.keyring.currentVersion,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    };
  }

  async decrypt(encrypted: EncryptedFieldData, aad: string): Promise<any> {
    if (!aad || typeof aad !== 'string') {
      throw new Error('AAD must be a non-empty string');
    }

    const keysToTry = [
      { version: this.keyring.currentVersion, key: this.keyring.currentKey },
      ...(this.keyring.previousKey
        ? [{ version: this.keyring.previousVersion!, key: this.keyring.previousKey }]
        : []),
    ];

    for (const { version, key } of keysToTry) {
      try {
        const keyBuffer = Buffer.from(key, 'base64');
        const iv = Buffer.from(encrypted.iv, 'base64');
        const authTag = Buffer.from(encrypted.authTag, 'base64');
        const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');
        const aadBuffer = Buffer.from(aad, 'utf8');

        const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
        decipher.setAAD(aadBuffer);
        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
          'utf8',
        );

        try {
          return JSON.parse(decrypted);
        } catch {
          return decrypted;
        }
      } catch (error) {
        if (version === keysToTry[keysToTry.length - 1].version) {
          throw new Error('Decryption failed with all available keys');
        }
      }
    }

    throw new Error('No valid keys available');
  }
}
