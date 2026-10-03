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

type LockTarget = { service: string; identifier: string } | { key: string };

export type LockOptions = LockTarget & {
  redis?: LockRedis;
  ttlMs?: number;
  heartbeat?: true;
  heartbeatMs?: number;
  maxMissed?: number;
  onLockLost?: (reason: LockLostReason) => void | Promise<void>;
};

export type ClaimOptions = LockTarget & {
  redis?: LockRedis;
  ttlMs?: number;
  heartbeat: false;
  holder?: string;
};

export type ClaimResult = { claimed: boolean; holder: string };

// With `waitMs` acquire keeps trying every `pollMs` until it wins or the wait runs out; without
// it acquire is one SET NX. `onTimeout` returns the error a timed-out wait should throw, so a
// caller that must fail loudly does not wrap a boolean in its own if/throw; without it a
// timed-out wait returns false like a plain contended acquire.
export type AcquireOptions = {
  waitMs?: number;
  pollMs?: number;
  onTimeout?: () => Error;
};

export type Lock = {
  acquire: (options?: AcquireOptions) => Promise<boolean>;
  verify: () => Promise<boolean>;
  release: () => Promise<LockReleaseResult>;
};

export type Claim = {
  acquire: () => Promise<ClaimResult>;
  verify: () => Promise<boolean>;
};
