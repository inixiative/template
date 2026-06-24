/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import { createLock } from '@template/db';
import { LogScope, log } from '@template/shared/logger';
import { runDrainOutboxPass } from '#/jobs/outbox/drain/pass';

// Per-worker in-process drain, not a queued cron — a queued drain shares the worker pool with the
// fan-out it meters and gets starved under load. createLock is the single-drainer guarantee across
// processes (heartbeated TTL + fenced release).
const DRAIN_INTERVAL_MS = 15_000;
const DRAIN_LOCK = { service: 'outbox-drain', identifier: 'drain', ttlMs: 300_000, heartbeatMs: 60_000, maxMissed: 3 };

let drainTimer: ReturnType<typeof setInterval> | null = null;
let draining = false; // in-process re-entrancy guard

const drainTick = async (): Promise<void> => {
  if (draining) return;
  draining = true;
  try {
    const lock = createLock(DRAIN_LOCK);
    if (!(await lock.acquire())) return;
    try {
      await runDrainOutboxPass();
    } finally {
      await lock.release();
    }
  } catch (err) {
    log.error('Outbox drain tick failed', err, LogScope.job);
  } finally {
    draining = false;
  }
};

export const startOutboxDrainLoop = (): void => {
  if (drainTimer) return;
  drainTimer = setInterval(() => void drainTick(), DRAIN_INTERVAL_MS);
  drainTimer.unref?.(); // don't keep the process alive for the drain alone
  log.info('Started overflow-buffer drain loop (in-process, every 15s)', LogScope.job);
};

export const stopOutboxDrainLoop = (): void => {
  if (drainTimer) {
    clearInterval(drainTimer);
    drainTimer = null;
  }
};
