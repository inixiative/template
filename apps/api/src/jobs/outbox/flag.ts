/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import { LogScope, log } from '@template/shared/logger';
import { heartbeat } from '@template/shared/utils';
import { flagKey, laneDepthCap, lowWater, overflowStuckMs, overflowTtlSec } from '#/jobs/outbox/config';
import { laneDepth, queueDepths } from '#/jobs/outbox/queueDepth';
import { queue } from '#/jobs/queue';
import { JobLane } from '#/jobs/types';

const LANES = [JobLane.fast, JobLane.slow] as const;

// --- one overflow flag per lane. Value = epoch ms when overflow began. ---
export const isOverflowing = async (lane: JobLane = JobLane.fast): Promise<boolean> =>
  (await queue.redis.get(flagKey(lane))) !== null;

// A slow job spills when its own share is full or when the whole budget is.
export const isLaneOverflowing = async (lane: JobLane): Promise<boolean> =>
  lane === JobLane.slow
    ? (await isOverflowing(JobLane.slow)) || (await isOverflowing(JobLane.fast))
    : isOverflowing(JobLane.fast);

// Set-once via NX so re-trips keep the original start time (used by the stuck-overflow alert),
// with a TTL the drain renews each tick — survives between ticks, self-clears if the drain dies.
const setOverflow = (lane: JobLane): Promise<unknown> =>
  queue.redis.set(flagKey(lane), String(Date.now()), 'EX', overflowTtlSec(), 'NX');
export const renewOverflow = (lane: JobLane = JobLane.fast): Promise<unknown> =>
  queue.redis.expire(flagKey(lane), overflowTtlSec());
export const clearOverflow = (lane: JobLane = JobLane.fast): Promise<unknown> => queue.redis.del(flagKey(lane));

// Trip a lane's flag inline when a direct add crosses its cap. Fresh probe (not cached): on a ramp the
// stale cache would trip late and let the queue overshoot — and tripIfFull only runs pre-overflow.
export const tripIfFull = async (): Promise<void> => {
  const depths = await queueDepths(true);
  for (const lane of LANES) if (laneDepth(depths, lane) >= laneDepthCap(lane)) await setOverflow(lane);
};

// Operational alert: overflow that won't clear means the drain can't keep up with arrivals.
export const warnIfOverflowStuck = async (lane: JobLane, depth: number): Promise<void> => {
  const startedAt = await queue.redis.get(flagKey(lane));
  if (startedAt === null) return;
  const ageMs = Date.now() - Number(startedAt);
  if (ageMs > overflowStuckMs()) {
    log.warn(
      `${lane} overflow stuck ${Math.round(ageMs / 60_000)}m — drain not keeping up (depth ${depth} ≥ low-water ${lowWater(lane)})`,
      LogScope.job,
    );
  }
};

// Hold both flags' TTLs open for the duration of `fn` via a heartbeat, so a long drain pass can't let
// one lapse mid-tick regardless of how long it runs. renewOverflow (EXPIRE) no-ops on an absent key,
// so the final renew never resurrects a flag the pass cleared.
export const withOverflowRenew = async <T>(fn: () => Promise<T>): Promise<T> => {
  const renewAll = async () => {
    for (const lane of LANES) await renewOverflow(lane);
  };
  const renewMs = Math.floor((overflowTtlSec() * 1000) / 3); // a third of the TTL — always below it by construction
  const stop = heartbeat(renewAll, renewMs);
  try {
    return await fn();
  } finally {
    stop();
    await renewAll().catch(() => {});
  }
};
