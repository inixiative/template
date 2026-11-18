export { FindForUpdateLockTimeoutError } from './findForUpdateLockTimeoutError';
export { LockLostError } from './lockLostError';
export { makeClaim } from './makeClaim';
export { makeLock } from './makeLock';
export { maxSafeHeartbeatMs } from './maxSafeHeartbeatMs';
export { singleFlightLock } from './singleFlight/singleFlightLock';
export type {
  AcquireOptions,
  Claim,
  ClaimOptions,
  ClaimResult,
  Lock,
  LockOptions,
  LockRedis,
  LockReleaseResult,
  LockSetTarget,
} from './types';
