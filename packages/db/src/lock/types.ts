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

export type Lock = {
  acquire: () => Promise<boolean>;
  verify: () => Promise<boolean>;
  release: () => Promise<LockReleaseResult>;
};

export type Claim = {
  acquire: () => Promise<ClaimResult>;
  verify: () => Promise<boolean>;
};
