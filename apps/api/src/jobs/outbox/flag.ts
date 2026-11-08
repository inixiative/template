/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import { LogScope, log } from '@template/shared/logger';
import { heartbeat } from '@template/shared/utils';
import {
  DEPTH_PROBE_MS,
  flagKey,
  laneDepthCap,
  lowWater,
  overflowStuckMs,
  overflowTtlSec,
} from '#/jobs/outbox/config';
import { laneDepth, type QueueDepths, queueDepths } from '#/jobs/outbox/queueDepth';
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
export const clearOverflow = (lane: JobLane = JobLane.fast): Promise<unknown> =>
  queue.redis.del(flagKey(lane));

const isAtCap = (depths: QueueDepths): boolean =>
  LANES.some((lane) => laneDepth(depths, lane) >= laneDepthCap(lane));

// Trip each lane's flag whose depth has reached its cap, from depths the caller already holds: the
// enqueue-side estimate, or the drain pass's per-tick read (so the flag turns itself on within a tick
// even when no single process saw the wave).
export const tripFromDepths = async (depths: QueueDepths): Promise<void> => {
  for (const lane of LANES)
    if (laneDepth(depths, lane) >= laneDepthCap(lane)) await setOverflow(lane);
};

// Probe fresh and trip from the result. Several Redis commands, so the enqueue path doesn't call this
// per job — it goes through the depth estimate below.
export const tripIfFull = async (): Promise<void> => tripFromDepths(await queueDepths(true));

// A rough, per-process queue depth: the last probe plus every add this process made since. An add that
// finds the probe older than `probeMs` re-probes (one shared in-flight probe) and the add count resets.
// The estimate only decides when to look: reaching a cap forces a fresh probe, and the flag trips on what
// that probe reads, so stale counts never trip it falsely. A wave of 20k or 100k adds therefore turns
// spilling on part-way through instead of overfilling Redis. Deliberately approximate — it sees only this
// process's adds, and adds made during a probe are dropped by the reset. It guards against catastrophic
// overfill, not exact admission: the drain tick trips from the real depth, and the cap sits well below
// Redis memory, so a small overshoot is harmless.
export const createDepthEstimator = (
  probeDepths: () => Promise<QueueDepths> = () => queueDepths(true),
  probeMs: number = DEPTH_PROBE_MS,
) => {
  let probed: { at: number; depths: QueueDepths } | null = null;
  let added = { total: 0, slow: 0 };
  let probing: Promise<void> | null = null;

  const probe = (): Promise<void> => {
    probing ??= probeDepths()
      .then((depths) => {
        probed = { at: Date.now(), depths };
        added = { total: 0, slow: 0 };
      })
      .finally(() => {
        probing = null;
      });
    return probing;
  };

  const estimate = (): QueueDepths | null =>
    probed && {
      ...probed.depths,
      total: probed.depths.total + added.total,
      slow: probed.depths.slow + added.slow,
    };

  const recordAdd = async (isSlow: boolean): Promise<void> => {
    added.total++;
    if (isSlow) added.slow++;
    const rough = estimate();
    const isStale = !probed || Date.now() - probed.at >= probeMs;
    if (isStale || !rough || isAtCap(rough)) await probe();
    const confirmed = estimate();
    if (confirmed) await tripFromDepths(confirmed);
  };

  return { recordAdd };
};

let depthEstimator: ReturnType<typeof createDepthEstimator> | null = null;
// The enqueue path's entry: one estimator over the jobs queue, created on first use.
export const recordAddAndTripIfFull = (isSlow: boolean): Promise<void> => {
  depthEstimator ??= createDepthEstimator();
  return depthEstimator.recordAdd(isSlow);
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
