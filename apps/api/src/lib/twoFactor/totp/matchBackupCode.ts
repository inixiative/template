/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses primitive:errors
 */
import { timingSafeEqual } from 'node:crypto';
import { makeError } from '#/lib/errors';
import { deriveBackupCodeDigest } from '#/lib/twoFactor/totp/generateBackupCodes';

const normalizeBackupCode = (raw: string): string => {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length !== 16) return cleaned;
  return [
    cleaned.slice(0, 4),
    cleaned.slice(4, 8),
    cleaned.slice(8, 12),
    cleaned.slice(12, 16),
  ].join('-');
};

export const consumeMatchingBackupCode = async (
  rawCode: string,
  storedHashes: readonly string[],
): Promise<string[]> => {
  const normalized = normalizeBackupCode(rawCode);
  if (!normalized) throw makeError({ status: 401, message: 'Invalid backup code' });

  const matches = await Promise.all(
    storedHashes.map(async (entry) => {
      const separator = entry.indexOf(':');
      if (separator <= 0) return false;

      const salt = entry.slice(0, separator);
      const expected = Buffer.from(entry.slice(separator + 1), 'hex');
      const actual = await deriveBackupCodeDigest(normalized, salt);
      return (
        expected.length === actual.length &&
        expected.length > 0 &&
        timingSafeEqual(expected, actual)
      );
    }),
  );

  const index = matches.indexOf(true);
  if (index === -1) throw makeError({ status: 401, message: 'Invalid backup code' });
  return storedHashes.filter((_, i) => i !== index);
};
