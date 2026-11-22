/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses infrastructure:redis, primitive:errors
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { redisClient, redisNamespace } from '@template/db';
import {
  TWO_FACTOR_TOTP_DIGITS,
  TWO_FACTOR_TOTP_PERIOD_SECONDS,
} from '@template/shared/auth/twoFactor';
import { makeError } from '#/lib/errors';
import { generateTotpCode } from '#/lib/twoFactor/totp/generateTotpCode';

const STEP_DRIFT_WINDOW = 1;
const REPLAY_TTL_SECONDS = (STEP_DRIFT_WINDOW * 2 + 2) * TWO_FACTOR_TOTP_PERIOD_SECONDS;

const replayKey = (userId: string, counter: number, secret: string): string => {
  const fingerprint = createHash('sha256').update(secret).digest('hex').slice(0, 16);
  return `${redisNamespace.otp}:totp-used:${userId}:${fingerprint}:${counter}`;
};

export const verifyTotpCodeOrThrow = async ({
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

  const normalizedBuf = Buffer.from(normalized, 'utf8');
  const baseCounter = Math.floor(timestampMs / 1000 / TWO_FACTOR_TOTP_PERIOD_SECONDS);
  let matchedCounter: number | null = null;

  for (let delta = -STEP_DRIFT_WINDOW; delta <= STEP_DRIFT_WINDOW; delta += 1) {
    const stepMs = (baseCounter + delta) * TWO_FACTOR_TOTP_PERIOD_SECONDS * 1000;
    const candidateBuf = Buffer.from(generateTotpCode(secret, stepMs), 'utf8');
    if (timingSafeEqual(normalizedBuf, candidateBuf) && matchedCounter === null) {
      matchedCounter = baseCounter + delta;
    }
  }

  if (matchedCounter === null) {
    throw makeError({ status, message: 'Invalid verification code' });
  }
  if (!userId) return;

  const result = await redisClient().set(
    replayKey(userId, matchedCounter, secret),
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
