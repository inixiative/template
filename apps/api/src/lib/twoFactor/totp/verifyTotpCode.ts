/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses infrastructure:redis, primitive:errors
 */
import { createHash } from 'node:crypto';
import { redisClient, redisNamespace } from '@template/db';
import {
  TWO_FACTOR_TOTP_DIGITS,
  TWO_FACTOR_TOTP_PERIOD_SECONDS,
} from '@template/shared/auth/twoFactor';
import { makeError } from '#/lib/errors';
import { createTotp } from '#/lib/twoFactor/totp/generateTotpCode';

const STEP_DRIFT_WINDOW = 1;
const REPLAY_TTL_SECONDS = (STEP_DRIFT_WINDOW * 2 + 2) * TWO_FACTOR_TOTP_PERIOD_SECONDS;

const replayKey = (userId: string, counter: number, secret: string): string => {
  const fingerprint = createHash('sha256').update(secret).digest('hex').slice(0, 16);
  return `${redisNamespace.otp}:totp-used:${userId}:${fingerprint}:${counter}`;
};

export const verifyTotpCode = async ({
  userId,
  secret,
  code,
  timestampMs = Date.now(),
  status = 401,
}: {
  userId?: string;
  secret: string;
  code: string;
  timestampMs?: number;
  status?: 400 | 401;
}): Promise<void> => {
  const normalized = code.replace(/[\s-]/g, '');
  if (!new RegExp(`^\\d{${TWO_FACTOR_TOTP_DIGITS}}$`).test(normalized)) {
    throw makeError({ status, message: 'Invalid verification code' });
  }

  const totp = createTotp(secret);
  const delta = totp.validate({
    token: normalized,
    timestamp: timestampMs,
    window: STEP_DRIFT_WINDOW,
  });
  if (delta === null) {
    throw makeError({ status, message: 'Invalid verification code' });
  }
  if (!userId) return;

  const baseCounter = Math.floor(timestampMs / 1000 / TWO_FACTOR_TOTP_PERIOD_SECONDS);
  const result = await redisClient().set(
    replayKey(userId, baseCounter + delta, totp.secret.base32),
    '1',
    'EX',
    REPLAY_TTL_SECONDS,
    'NX',
  );
  if (result !== 'OK') {
    throw makeError({
      status,
      message: 'Verification code has already been used. Wait for the next code.',
    });
  }
};
