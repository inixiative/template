/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses none
 */
import { randomBytes, scrypt } from 'node:crypto';
import { TWO_FACTOR_BACKUP_CODE_COUNT } from '@template/shared/auth/twoFactor';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const GROUP_LENGTH = 4;
const GROUP_COUNT = 4;

const BACKUP_CODE_SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;
const BACKUP_CODE_KEY_LENGTH = 32;

export const deriveBackupCodeDigest = (code: string, salt: string): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scrypt(code, salt, BACKUP_CODE_KEY_LENGTH, BACKUP_CODE_SCRYPT_PARAMS, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });

const randomCode = (): string => {
  let chars = '';
  for (const byte of randomBytes(GROUP_LENGTH * GROUP_COUNT)) chars += ALPHABET[byte & 31];
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12), chars.slice(12, 16)].join('-');
};

const hashCode = async (code: string): Promise<string> => {
  const salt = randomBytes(16).toString('hex');
  const digest = (await deriveBackupCodeDigest(code, salt)).toString('hex');
  return `${salt}:${digest}`;
};

export const generateBackupCodes = async (
  count = TWO_FACTOR_BACKUP_CODE_COUNT,
): Promise<{ codes: string[]; hashes: string[] }> => {
  const codes = Array.from({ length: count }, randomCode);
  const hashes = await Promise.all(codes.map(hashCode));
  return { codes, hashes };
};
