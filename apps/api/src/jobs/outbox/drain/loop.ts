/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import { createLock } from '@template/db';
import { LogScope, log } from '@template/shared/logger';
import { runDrainOutboxPass } from '#/jobs/outbox/drain/pass';

const DRAIN_INTERVAL_MS = 15_000;
const DRAIN_LOCK = { service: 'outbox-drain', identifier: 'drain', ttlMs: 300_000, heartbeatMs: 60_000, maxMissed: 3 };

let drainTimer: ReturnType<typeof setInterval> | null = null;

// No re-entrancy guard: createLock's NX acquire already skips a tick whose predecessor is still draining.
const drainTick = async (): Promise<void> => {
  const lock = createLock(DRAIN_LOCK);
  try {
    if (!(await lock.acquire())) return;
    try {
      await runDrainOutboxPass();
    } finally {
      await lock.release();
    }
  } catch (err) {
    log.error('Outbox drain tick failed', err, LogScope.job);
  }
};

export const startOutboxDrainLoop = (): void => {
  if (drainTimer) return;
  drainTimer = setInterval(() => void drainTick(), DRAIN_INTERVAL_MS);
  log.info('Started overflow-buffer drain loop (in-process, every 15s)', LogScope.job);
};

export const stopOutboxDrainLoop = (): void => {
  if (drainTimer) {
    clearInterval(drainTimer);
    drainTimer = null;
  }
};
