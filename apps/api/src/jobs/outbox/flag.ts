/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import { LogScope, log } from '@template/shared/logger';
import { FLAG_KEY, lowWater, maxQueueDepth, overflowStuckMs, overflowTtlSec } from '#/jobs/outbox/config';
import { queueDepth } from '#/jobs/outbox/queueDepth';
import { queue } from '#/jobs/queue';

// --- the overflow flag (global). Value = epoch ms when overflow began. ---
export const isOverflowing = async (): Promise<boolean> => (await queue.redis.get(FLAG_KEY)) !== null;
// Set-once via NX so re-trips keep the original start time (used by the stuck-overflow alert),
// with a TTL the drain renews each tick — survives between ticks, self-clears if the drain dies.
const setOverflow = (): Promise<unknown> => queue.redis.set(FLAG_KEY, String(Date.now()), 'EX', overflowTtlSec(), 'NX');
export const renewOverflow = (): Promise<unknown> => queue.redis.expire(FLAG_KEY, overflowTtlSec());
export const clearOverflow = (): Promise<unknown> => queue.redis.del(FLAG_KEY);

// Trip the flag inline when a direct add crosses the cap. Fresh probe (not cached): on a ramp the
// stale cache would trip late and let the queue overshoot — and tripIfFull only runs pre-overflow.
export const tripIfFull = async (): Promise<void> => {
  if ((await queueDepth(true)) >= maxQueueDepth()) await setOverflow();
};

// Operational alert: overflow that won't clear means the drain can't keep up with arrivals.
export const warnIfOverflowStuck = async (depth: number): Promise<void> => {
  const startedAt = await queue.redis.get(FLAG_KEY);
  if (startedAt === null) return;
  const ageMs = Date.now() - Number(startedAt);
  if (ageMs > overflowStuckMs()) {
    log.warn(
      `overflow stuck ${Math.round(ageMs / 60_000)}m — drain not keeping up (depth ${depth} ≥ low-water ${lowWater()})`,
      LogScope.job,
    );
  }
};

// Hold the flag's TTL open for the duration of `fn` via a recursive renew (like createLock's
// heartbeat), so a long drain pass can't let it lapse mid-tick regardless of how long it runs —
// no reliance on TTL > tick duration. renewOverflow (EXPIRE) no-ops on an absent key, so the final
// renew never resurrects a flag the pass cleared.
export const withOverflowRenew = async <T>(fn: () => Promise<T>): Promise<T> => {
  const renewMs = Math.floor((overflowTtlSec() * 1000) / 3); // a third of the TTL — always below it by construction
  let timer: ReturnType<typeof setTimeout> | null = null;
  const beat = (): void => {
    timer = setTimeout(() => {
      void renewOverflow().catch(() => {});
      beat();
    }, renewMs);
  };
  beat();
  try {
    return await fn();
  } finally {
    if (timer) clearTimeout(timer);
    await renewOverflow().catch(() => {});
  }
};
