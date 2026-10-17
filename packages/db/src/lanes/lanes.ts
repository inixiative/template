/**
 * @atlas
 * @kind service
 * @partOf infrastructure:redis, mutex
 * @uses none
 */
import { ageGatedReclaim } from '@template/db/lanes/queries/ageGatedReclaim';
import { evictingClaim } from '@template/db/lanes/queries/evictingClaim';
import { fencedRelease } from '@template/db/lanes/queries/fencedRelease';
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

// Marks one job superseded by id, without touching any lane. A superseding child writes its own when
// it finds its parent superseded, so the tombstone reaches its children in turn.
export const tombstoneJob = (jobId: string, supersededBy: string): Promise<unknown> =>
  getRedisClient().set(supersededKey(jobId), supersededBy, 'EX', SUPERSEDED_TTL_SEC);

// A superseding staged job parked in `waiting-children` is not running, so nothing refreshes its lane
// (LANE_TTL_SEC assumes a running job's watchLane). If the lane expired while it waited, a newer
// enqueue would find it empty and never tombstone the parked job, so neither it nor its children would
// stop, and it would run `finish` when it woke. So the parked holder stretches its lane to the
// tombstone's lifetime. Only the current holder does; a job already replaced leaves the lane alone.
// When it resumes, watchLane puts the normal TTL back.
export const holdLaneWhileParked = async (lane: string, jobId: string): Promise<boolean> => {
  if ((await getRedisClient().get(lane)) !== jobId) return false;
  await getRedisClient().expire(lane, SUPERSEDED_TTL_SEC);
  return true;
};

// Re-assert a lapsed baton at job start, never displacing a newer holder (see ageGatedReclaim).
export const reclaimLane = (lane: string, jobId: string): Promise<unknown> =>
  ageGatedReclaim(
    getRedisClient(),
    lane,
    jobId,
    LANE_TTL_SEC,
    SUPERSEDED_PREFIX,
    SUPERSEDED_TTL_SEC,
  );

// Roll back a claim when the subsequent queue.add/outbox spill fails. Best-effort, but never silent:
// if this fenced cleanup fails (transient redis/script error) the phantom jobId lingers in the lane key
// until TTL (≤5min), so an older in-flight job can be wrongly treated as superseded. Log it so that
// window is diagnosable rather than invisible.
export const releaseLane = (
  lane: string,
  jobId: string,
  previousHolder?: string | null,
): Promise<unknown> =>
  fencedRelease(getRedisClient(), lane, jobId, previousHolder ?? '', SUPERSEDED_PREFIX).catch(
    (err) => {
      log.error(`releaseLane: fenced delete failed; lane key will linger until TTL: ${lane}`, err);
      return null;
    },
  );

// Hold the lane as jobId and fire onUsurped once a *different* job takes the baton; returns stop().
// While we're still the holder we REFRESH the TTL each poll, so the lane never expires out from under
// a long-running holder — otherwise an expired lane reads as null and a stale older job (running past
// the TTL) would never see the usurp. An absent lane therefore means "no active claimant", not a usurp.
// With a `parentId`, a tombstone on the parent fires onUsurped too, after tombstoning this job with the
// parent's superseder so its own children see it.
export const watchLane = (
  lane: string,
  jobId: string,
  onUsurped: () => void,
  parentId?: string,
): (() => void) =>
  heartbeat(async () => {
    const parentSupersededBy = parentId ? await getJobSupersededBy(parentId) : null;
    if (parentSupersededBy) {
      await tombstoneJob(jobId, parentSupersededBy);
      onUsurped();
      return;
    }
    const holder = await getRedisClient().get(lane);
    if (holder === jobId) await getRedisClient().pexpire(lane, LANE_TTL_SEC * 1000);
    else if (holder !== null) onUsurped();
  }, LANE_POLL_MS);
