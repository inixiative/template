/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses infrastructure:redis
 */
import { getRedisClient, redisNamespace } from '@template/db';
import { PERSON_JWT_TTL_SECONDS } from '#/lib/auth/personJwt';

const validAfterKey = (userId: string) => `${redisNamespace.jwtValidAfter}:${userId}`;

const CLOCK_TOLERANCE_SECONDS = 30;

export const revokeUserJwts = async (userId: string): Promise<void> => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  await getRedisClient().setex(
    validAfterKey(userId),
    PERSON_JWT_TTL_SECONDS + CLOCK_TOLERANCE_SECONDS,
    String(nowSeconds),
  );
};

export const jwtValidAfter = async (userId: string): Promise<number | null> => {
  const value = await getRedisClient().get(validAfterKey(userId));
  return value === null ? null : Number(value);
};
