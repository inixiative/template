/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import { createLock } from '@template/db';
import { LogScope, log } from '@template/shared/logger';
import { runDrainOutboxPass } from '#/jobs/outbox/drain/pass';
import { makeUnrefInterval } from '#/lib/utils/makeUnrefInterval';

const DRAIN_INTERVAL_MS = 15_000;
const DRAIN_LOCK = { service: 'outbox-drain', identifier: 'drain', ttlMs: 300_000, heartbeatMs: 60_000, maxMissed: 3 };

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

const drainLoop = makeUnrefInterval({ intervalMs: DRAIN_INTERVAL_MS, tick: () => void drainTick() });

export const startOutboxDrainLoop = (): void => {
  if (drainLoop.isRunning()) return;
  drainLoop.start();
  log.info('Started overflow-buffer drain loop (in-process, every 15s)', LogScope.job);
};

export const stopOutboxDrainLoop = drainLoop.stop;
