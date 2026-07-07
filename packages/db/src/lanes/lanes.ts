/**
 * @atlas
 * @kind service
 * @partOf infrastructure:redis
 * @uses none
 */
import { getRedisClient } from '@template/db/redis/client';
import { redisNamespace } from '@template/db/redis/namespaces';
import { log } from '@template/shared/logger';
import { heartbeat } from '@template/shared/utils';

const LANE_TTL_SEC = 300;
const SUPERSEDED_TTL_SEC = 7 * 24 * 60 * 60;
const LANE_POLL_MS = 500;
const SUPERSEDED_PREFIX = `${redisNamespace.superseded}:`;

// Full redis key for a supersede lane, scoped to (handlerName, dedupeKey).
export const laneKey = (handlerName: string, dedupeKey: string): string =>
  `${redisNamespace.lane}:${handlerName}:${dedupeKey}`;

export const supersededKey = (jobId: string): string => `${SUPERSEDED_PREFIX}${jobId}`;

// Take the baton: record jobId as the lane's holder, evicting whoever held it (last claim wins).
// The claim happens at ENQUEUE time but is only refreshed by watchLane once the job RUNS, so the TTL
// must cover the whole off-worker window: any scheduled `delay` (measured from enqueue) plus the base
// TTL as the queue-wait buffer. A baton that expires before its job starts reads as "no active
// claimant" to an older in-flight job — the usurp is missed and stale superseded work keeps running.
//
// The per-job superseded marker is the durable edge: if job A is queued, job B claims the lane, and
// the lane TTL expires before A starts, A still finds `superseded:A = B` and exits instead of
// resurrecting stale work.
const CLAIM_LANE = `
local previous = redis.call('get', KEYS[1])
redis.call('set', KEYS[1], ARGV[1], 'EX', ARGV[2])
if previous and previous ~= ARGV[1] then
  redis.call('set', ARGV[3] .. previous, ARGV[1], 'EX', ARGV[4])
end
return previous
`;
export const claimLane = async (lane: string, jobId: string, delayMs = 0): Promise<string | null> => {
  const previous = await getRedisClient().eval(
    CLAIM_LANE,
    1,
    lane,
    jobId,
    String(LANE_TTL_SEC + Math.ceil(delayMs / 1000)),
    SUPERSEDED_PREFIX,
    String(SUPERSEDED_TTL_SEC),
  );
  return typeof previous === 'string' ? previous : null;
};

export const getJobSupersededBy = async (jobId: string): Promise<string | null> =>
  getRedisClient().get(supersededKey(jobId));

// Self-heal for the residual expiry window (queue wait > base TTL): when a superseding job STARTS, it
// re-asserts its claim iff the lane is vacant — NX, so a live holder (a newer enqueue's claim) is
// never clobbered and the newer-claim-usurps semantics are untouched. Without this, a baton that
// lapsed while its job sat waiting stays vacant for the whole run: the run is invisible to lane
// reads, nothing refreshes the key, and a concurrently running older job never sees a usurp.
export const reclaimLaneIfVacant = (lane: string, jobId: string): Promise<unknown> =>
  getRedisClient().set(lane, jobId, 'EX', LANE_TTL_SEC, 'NX');

// Fenced release: drop the baton only if WE still hold it (atomic, so a concurrent claim isn't
// clobbered). Used to roll back a claim when the subsequent queue.add/outbox spill fails. If our
// failed claim superseded a previous holder, also clear that tombstone only when it still points at
// us; a later claimant's tombstone is never clobbered.
const FENCED_RELEASE = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  redis.call('del', KEYS[1])
  if ARGV[2] ~= '' then
    local tombstone = ARGV[3] .. ARGV[2]
    if redis.call('get', tombstone) == ARGV[1] then
      redis.call('del', tombstone)
    end
  end
end
return 0
`;
export const releaseLane = (lane: string, jobId: string, previousHolder?: string | null): Promise<unknown> =>
  // Best-effort, but never silent: if this fenced cleanup fails (transient redis/script error) the
  // phantom jobId lingers in the lane key until TTL (≤5min), so an older in-flight job can be wrongly
  // treated as superseded. Log it so that window is diagnosable rather than invisible.
  getRedisClient()
    .eval(FENCED_RELEASE, 1, lane, jobId, previousHolder ?? '', SUPERSEDED_PREFIX)
    .catch((err) => {
      log.error(`releaseLane: fenced delete failed; lane key will linger until TTL: ${lane}`, err);
      return null;
    });

// Hold the lane as jobId and fire onUsurped once a *different* job takes the baton; returns stop().
// While we're still the holder we REFRESH the TTL each poll, so the lane never expires out from under
// a long-running holder — otherwise an expired lane reads as null and a stale older job (running past
// the TTL) would never see the usurp. An absent lane therefore means "no active claimant", not a usurp.
export const watchLane = (lane: string, jobId: string, onUsurped: () => void): (() => void) =>
  heartbeat(async () => {
    const holder = await getRedisClient().get(lane);
    if (holder === jobId) await getRedisClient().pexpire(lane, LANE_TTL_SEC * 1000);
    else if (holder !== null) onUsurped();
  }, LANE_POLL_MS);
