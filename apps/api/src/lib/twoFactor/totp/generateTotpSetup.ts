/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses none
 */
import { randomBytes } from 'node:crypto';
import {
  TWO_FACTOR_TOTP_DIGITS,
  TWO_FACTOR_TOTP_PERIOD_SECONDS,
} from '@template/shared/auth/twoFactor';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const encodeBase32 = (bytes: Uint8Array): string => {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
};

export const generateTotpSetup = ({
  issuer,
  accountName,
}: {
  issuer: string;
  accountName: string;
}): { secret: string; otpauthUri: string; issuer: string; accountName: string } => {
  const secret = encodeBase32(randomBytes(20));
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(TWO_FACTOR_TOTP_DIGITS),
    period: String(TWO_FACTOR_TOTP_PERIOD_SECONDS),
  });

  return {
    secret,
    otpauthUri: `otpauth://totp/${label}?${params.toString()}`,
    issuer,
    accountName,
  };
};
