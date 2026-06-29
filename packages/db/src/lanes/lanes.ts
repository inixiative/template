/**
 * @atlas
 * @kind service
 * @partOf infrastructure:redis
 * @uses none
 */
import { getRedisClient } from '@template/db/redis/client';
import { redisNamespace } from '@template/db/redis/namespaces';
import { heartbeat } from '@template/shared/utils';

const LANE_TTL_SEC = 300;
const LANE_POLL_MS = 500;

// Full redis key for a supersede lane, scoped to (handlerName, dedupeKey).
export const laneKey = (handlerName: string, dedupeKey: string): string =>
  `${redisNamespace.lane}:${handlerName}:${dedupeKey}`;

// Take the baton: record jobId as the lane's holder, evicting whoever held it (last claim wins).
export const claimLane = (lane: string, jobId: string): Promise<unknown> =>
  getRedisClient().set(lane, jobId, 'EX', LANE_TTL_SEC);

// Fenced release: drop the baton only if WE still hold it — atomic in one Lua eval so the key can't
// expire and be re-claimed between a separate GET and DEL (which would delete a newer holder's lane).
// Used to roll back a claim when the subsequent queue.add fails, so a job that never got created can't
// leave a phantom holder that usurps the real prior job.
const FENCED_DEL = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
export const releaseLane = (lane: string, jobId: string): Promise<unknown> =>
  getRedisClient()
    .eval(FENCED_DEL, 1, lane, jobId)
    .catch(() => null);

// Hold the lane as jobId and fire onUsurped once a newer job takes the baton; returns stop(). While
// we're still the holder we REFRESH the TTL each poll, so the lane never expires out from under a
// long-running holder — otherwise an expired lane reads as null and a stale older job (running past
// the TTL) would never see a later usurp. An absent (expired) lane therefore counts as still held —
// only a *different* holder is a usurp.
export const watchLane = (lane: string, jobId: string, onUsurped: () => void): (() => void) =>
  heartbeat(async () => {
    const holder = await getRedisClient().get(lane);
    if (holder === jobId) await getRedisClient().pexpire(lane, LANE_TTL_SEC * 1000);
    else if (holder !== null) onUsurped();
  }, LANE_POLL_MS);
