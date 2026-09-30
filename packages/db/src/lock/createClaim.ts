/**
 * @atlas
 * @kind constructor
 * @partOf infrastructure:prisma, infrastructure:redis
 * @uses none
 */
import { claimOnce } from '@template/db/lock/queries/claimOnce';
import type { Claim, ClaimOptions, ClaimResult, LockRedis } from '@template/db/lock/types';

export const createClaim = (opts: ClaimOptions, redis: LockRedis, key: string): Claim => {
  const ttlMs = opts.ttlMs ?? 30_000;
  const holder = opts.holder ?? crypto.randomUUID();

  return {
    acquire: async (): Promise<ClaimResult> => {
      const incumbent = await claimOnce(redis, key, holder, ttlMs);
      return typeof incumbent === 'string' ? { claimed: false, holder: incumbent } : { claimed: true, holder };
    },
    verify: async () => (await redis.get(key)) === holder,
  };
};
