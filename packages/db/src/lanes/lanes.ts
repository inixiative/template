/**
 * @atlas
 * @kind service
 * @partOf infrastructure:redis, mutex
 * @uses none
 */
import {
  claimLaneUnlessNewerHolder as claimLaneUnlessNewerHolderQuery,
  type LaneClaim,
} from '@template/db/lanes/queries/claimLaneUnlessNewerHolder';
import { evictingClaim } from '@template/db/lanes/queries/evictingClaim';
import { markDisplacedHolder as markDisplacedHolderQuery } from '@template/db/lanes/queries/markDisplacedHolder';
import { pollLane } from '@template/db/lanes/queries/pollLane';
import { redisNamespace } from '@template/db/redis/namespaces';
import type { RedisEval } from '@template/db/redis/types';
import { startHeartbeat } from '@template/shared/utils';
import type { Redis } from 'ioredis';

const LANE_TTL_SEC = 300;
const PARKED_LANE_TTL_SEC = 3 * 60 * 60;
const LANE_POLL_MS = 500;

export type LaneStore = {
  redis: RedisEval & Pick<Redis, 'get' | 'hget' | 'expire'>;
  holderKeyPrefix: string;
  supersededField: string;
};

export type { LaneClaim };

export const laneKey = (handlerName: string, dedupeKey: string): string =>
  `${redisNamespace.lane}:${handlerName}:${dedupeKey}`;

export const claimLane = (
  { redis }: LaneStore,
  lane: string,
  holderId: string,
  delayMs = 0,
): Promise<string | null> =>
  evictingClaim(redis, lane, holderId, LANE_TTL_SEC + Math.ceil(delayMs / 1000));

export const claimLaneUnlessNewerHolder = (
  { redis, holderKeyPrefix }: LaneStore,
  lane: string,
  holderId: string,
  delayMs = 0,
): Promise<LaneClaim> =>
  claimLaneUnlessNewerHolderQuery(
    redis,
    lane,
    holderId,
    LANE_TTL_SEC + Math.ceil(delayMs / 1000),
    holderKeyPrefix,
  );

export const markDisplacedHolder = (
  { redis, holderKeyPrefix, supersededField }: LaneStore,
  lane: string,
  holderId: string,
  previous: string | null,
): Promise<void> =>
  markDisplacedHolderQuery(redis, lane, holderId, previous, holderKeyPrefix, supersededField);

export const fetchSupersededBy = (
  { redis, holderKeyPrefix, supersededField }: LaneStore,
  holderId: string,
): Promise<string | null> => redis.hget(`${holderKeyPrefix}${holderId}`, supersededField);

export const holdLaneWhileParked = async (
  { redis }: LaneStore,
  lane: string,
  holderId: string,
): Promise<boolean> => {
  if ((await redis.get(lane)) !== holderId) return false;
  await redis.expire(lane, PARKED_LANE_TTL_SEC);
  return true;
};

export type WatchedLane = {
  lane: string;
  holderId: string;
  parent?: { holderId: string; lane?: string };
};

export const watchLane = (
  store: LaneStore,
  { lane, holderId, parent }: WatchedLane,
  onSuperseded: (supersededBy: string) => void,
): (() => void) =>
  startHeartbeat(async () => {
    const supersededBy = await pollLane(store.redis, {
      lane,
      holderId,
      parent,
      holderKeyPrefix: store.holderKeyPrefix,
      supersededField: store.supersededField,
      laneTtlMs: LANE_TTL_SEC * 1000,
      parkedLaneTtlMs: PARKED_LANE_TTL_SEC * 1000,
    });
    if (supersededBy) onSuperseded(supersededBy);
  }, LANE_POLL_MS);
