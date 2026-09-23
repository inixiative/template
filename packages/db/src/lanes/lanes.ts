/**
 * @atlas
 * @kind service
 * @partOf infrastructure:redis
 * @uses none
 */
import { ageGatedReclaim } from '@template/db/lanes/queries/ageGatedReclaim';
import { evictingClaim } from '@template/db/lanes/queries/evictingClaim';
import { fencedRelease } from '@template/db/lanes/queries/fencedRelease';
import { fencedTransfer } from '@template/db/lanes/queries/fencedTransfer';
import { getRedisClient } from '@template/db/redis/client';
import { redisNamespace } from '@template/db/redis/namespaces';
import { log } from '@template/shared/logger';
import { heartbeat } from '@template/shared/utils';

const LANE_TTL_SEC = 300;
const SUPERSEDED_TTL_SEC = 7 * 24 * 60 * 60;
const LANE_POLL_MS = 500;
const SUPERSEDED_PREFIX = `${redisNamespace.lane}:superseded:`;

// Full redis key for a supersede lane, scoped to (handlerName, dedupeKey).
export const laneKey = (handlerName: string, dedupeKey: string): string =>
  `${redisNamespace.lane}:${handlerName}:${dedupeKey}`;

export const supersededKey = (jobId: string): string => `${SUPERSEDED_PREFIX}${jobId}`;

// Last claim wins; the TTL covers any scheduled delay plus the queue-wait buffer (see evictingClaim).
export const claimLane = (lane: string, jobId: string, delayMs = 0): Promise<string | null> =>
  evictingClaim(
    getRedisClient(),
    lane,
    jobId,
    LANE_TTL_SEC + Math.ceil(delayMs / 1000),
    SUPERSEDED_PREFIX,
    SUPERSEDED_TTL_SEC,
  );

export const getJobSupersededBy = async (jobId: string): Promise<string | null> =>
  getRedisClient().get(supersededKey(jobId));

// Re-assert a lapsed baton at job start, never displacing a newer holder (see ageGatedReclaim).
export const reclaimLane = (lane: string, jobId: string): Promise<unknown> =>
  ageGatedReclaim(getRedisClient(), lane, jobId, LANE_TTL_SEC, SUPERSEDED_PREFIX, SUPERSEDED_TTL_SEC);

// Roll back a claim when the subsequent queue.add/outbox spill fails. Best-effort, but never silent:
// if this fenced cleanup fails (transient redis/script error) the phantom jobId lingers in the lane key
// until TTL (≤5min), so an older in-flight job can be wrongly treated as superseded. Log it so that
// window is diagnosable rather than invisible.
export const releaseLane = (lane: string, jobId: string, previousHolder?: string | null): Promise<unknown> =>
  fencedRelease(getRedisClient(), lane, jobId, previousHolder ?? '', SUPERSEDED_PREFIX).catch((err) => {
    log.error(`releaseLane: fenced delete failed; lane key will linger until TTL: ${lane}`, err);
    return null;
  });

// Hold the lane as jobId and fire onUsurped once a *different* job takes the baton; returns stop().
// While we're still the holder we REFRESH the TTL each poll, so the lane never expires out from under
// a long-running holder — otherwise an expired lane reads as null and a stale older job (running past
// the TTL) would never see the usurp. An absent lane therefore means "no active claimant", not a usurp.
export const transferLane = (lane: string, fromJobId: string, toJobId: string): Promise<boolean> =>
  fencedTransfer(getRedisClient(), lane, fromJobId, toJobId, SUPERSEDED_PREFIX, LANE_TTL_SEC, SUPERSEDED_TTL_SEC);

export const watchLane = (lane: string, jobId: string, onUsurped: () => void): (() => void) =>
  heartbeat(async () => {
    const holder = await getRedisClient().get(lane);
    if (holder === jobId) await getRedisClient().pexpire(lane, LANE_TTL_SEC * 1000);
    else if (holder !== null) onUsurped();
  }, LANE_POLL_MS);
