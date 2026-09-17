/**
 * @atlas
 * @kind type
 * @partOf infrastructure:prisma, infrastructure:redis
 * @uses none
 */
import type { Redis } from 'ioredis';

export type LockRedis = Pick<Redis, 'set' | 'get' | 'eval'>;
export type LockLostReason = 'token_mismatch' | 'refresh_errors';
export type LockReleaseResult = 'released' | 'notHeld' | 'unconfirmed';

// `redis` runs the lock on a caller-owned connection (the jobs queue's, not the shared cache
// client); `key` keeps a caller-owned key instead of `lock:<service>:<identifier>`.
export type LockOptions = ({ service: string; identifier: string } | { key: string }) & {
  redis?: LockRedis;
  ttlMs?: number;
  heartbeatMs?: number;
  maxMissed?: number;
  onLockLost?: (reason: LockLostReason) => void | Promise<void>;
};

export type Lock = {
  acquire: () => Promise<boolean>;
  verify: () => Promise<boolean>;
  release: () => Promise<LockReleaseResult>;
};
