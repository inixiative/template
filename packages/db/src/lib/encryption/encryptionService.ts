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

    const plaintextStr = JSON.stringify(plaintext);

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
    const key = encrypted.version === this.keyring.currentVersion ? this.keyring.currentKey : this.keyring.previousKey;

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(key!, 'base64'),
      Buffer.from(encrypted.iv, 'base64'),
    );

    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(Buffer.from(encrypted.authTag, 'base64'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');

    return JSON.parse(decrypted);
  }
}
