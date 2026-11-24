/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses none
 */
import {
  TWO_FACTOR_TOTP_DIGITS,
  TWO_FACTOR_TOTP_PERIOD_SECONDS,
} from '@template/shared/auth/twoFactor';
import * as OTPAuth from 'otpauth';

export const createTotp = (secret: string, options?: { issuer?: string; label?: string }) => {
  if (!secret) throw new Error('TOTP secret is required');
  return new OTPAuth.TOTP({
    issuer: options?.issuer,
    label: options?.label,
    algorithm: 'SHA1',
    digits: TWO_FACTOR_TOTP_DIGITS,
    period: TWO_FACTOR_TOTP_PERIOD_SECONDS,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
};

export const generateTotpCode = (secret: string, timestampMs = Date.now()): string =>
  createTotp(secret).generate({ timestamp: timestampMs });
