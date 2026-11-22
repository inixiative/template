/**
 * @atlas
 * @kind query
 * @partOf infrastructure:redis
 * @uses none
 */
import type { RedisEval } from '@template/db/redis/types';

// One heartbeat of a running holder, in one round trip. Returns who superseded it, or null.
// Superseded when its own record says so, when its parent's record says so (copied onto its own so its
// children stop in turn), or when another holder that exists now holds its lane. Otherwise it refreshes
// its own lane, and its parent's lane while the parent still holds it, so a parked parent outlives the
// lane TTL for as long as a child runs.
const POLL_LANE = `
local me = ARGV[1]
local parent = ARGV[2]
local prefix = ARGV[3]
local field = ARGV[4]
local mine = redis.call('hget', prefix .. me, field)
if mine then return mine end
if parent ~= '' then
  local parentSupersededBy = redis.call('hget', prefix .. parent, field)
  if parentSupersededBy then
    if redis.call('exists', prefix .. me) == 1 then
      redis.call('hset', prefix .. me, field, parentSupersededBy)
    end
    return parentSupersededBy
  end
  if KEYS[2] ~= KEYS[1] and redis.call('get', KEYS[2]) == parent then
    redis.call('pexpire', KEYS[2], ARGV[6])
  end
end
local holder = redis.call('get', KEYS[1])
if holder == me then
  redis.call('pexpire', KEYS[1], ARGV[5])
  return false
end
if holder and redis.call('exists', prefix .. holder) == 1 then
  if redis.call('exists', prefix .. me) == 1 then redis.call('hset', prefix .. me, field, holder) end
  return holder
end
return false
`;

export type LanePoll = {
  lane: string;
  holderId: string;
  parent?: { holderId: string; lane?: string };
  holderKeyPrefix: string;
  supersededField: string;
  laneTtlMs: number;
  parkedLaneTtlMs: number;
};

export const pollLane = async (
  redis: RedisEval,
  {
    lane,
    holderId,
    parent,
    holderKeyPrefix,
    supersededField,
    laneTtlMs,
    parkedLaneTtlMs,
  }: LanePoll,
): Promise<string | null> => {
  const supersededBy = await redis.eval(
    POLL_LANE,
    2,
    lane,
    parent?.lane ?? lane,
    holderId,
    parent?.holderId ?? '',
    holderKeyPrefix,
    supersededField,
    String(laneTtlMs),
    String(parkedLaneTtlMs),
  );
  return typeof supersededBy === 'string' ? supersededBy : null;
};
