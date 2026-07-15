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

// Hold the lane as jobId and fire onUsurped once a newer job takes the baton; returns stop(). An
// absent (expired) lane counts as still held — only a *different* holder is a usurp.
export const watchLane = (lane: string, jobId: string, onUsurped: () => void): (() => void) =>
  heartbeat(async () => {
    const holder = await getRedisClient().get(lane);
    if (holder !== null && holder !== jobId) onUsurped();
  }, LANE_POLL_MS);
