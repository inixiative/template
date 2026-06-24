/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import { redisNamespace } from '@template/db';
import { queue } from '#/jobs/queue';

// A supersede lane is scoped to (handlerName, dedupeKey) — only the latest job enqueued in a lane
// survives; older jobs in the same lane abort. Scoping by handler keeps two handlers whose
// dedupeKeyFns emit the same string from colliding.
export const laneKey = (handlerName: string, dedupeKey: string): string => `${handlerName} ${dedupeKey}`;

const laneRedisKey = (lane: string): string => `${redisNamespace.job}:lane:${lane}`;
const LANE_TTL_SEC = 300; // a lane no live job is holding self-expires

// Record jobId as the lane's current (latest) holder. The prior holder sees the change on its next
// poll and aborts — no queue scan, no broadcast, just an O(1) write.
export const claimLane = (lane: string, jobId: string): Promise<unknown> =>
  queue.redis.set(laneRedisKey(lane), jobId, 'EX', LANE_TTL_SEC);

// Whether jobId is still the lane's holder. Absent (expired) counts as held — only a *different* id
// means a newer job claimed the lane, i.e. this one is superseded.
export const holdsLane = async (lane: string, jobId: string): Promise<boolean> => {
  const current = await queue.redis.get(laneRedisKey(lane));
  return current === null || current === jobId;
};
