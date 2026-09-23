/**
 * @atlas
 * @kind query
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import type { Redis } from 'ioredis';

// The one owner of fleet slow-lane capacity. In a single eval: drop expired slot leases and expired
// worker presence, compute the cap (an explicit fleet-wide slot count, else
// max(1, floor(concurrency × fraction × live workers))), and optionally reserve `member`.
// A member that already holds a lease is renewed and accepted even when the set sits exactly at
// the cap — that is how an admission's reservation is picked up by the worker that runs it.
const EVALUATE_BULK_CAPACITY = `
local now = ARGV[1]
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now)

local liveWorkers = redis.call('ZCARD', KEYS[2])
local configuredSlots = tonumber(ARGV[2])
local cap
if configuredSlots then
  cap = math.max(1, math.floor(configuredSlots))
else
  cap = math.max(1, math.floor(tonumber(ARGV[3]) * tonumber(ARGV[4]) * liveWorkers))
end

local occupied = redis.call('ZCARD', KEYS[1])
local member = ARGV[5]
local claimed = 0
if member ~= '' then
  if redis.call('ZSCORE', KEYS[1], member) then
    redis.call('ZADD', KEYS[1], ARGV[6], member)
    redis.call('PEXPIRE', KEYS[1], ARGV[7])
    claimed = 1
  elseif occupied < cap then
    redis.call('ZADD', KEYS[1], ARGV[6], member)
    redis.call('PEXPIRE', KEYS[1], ARGV[7])
    occupied = occupied + 1
    claimed = 1
  end
end

return { claimed, cap, occupied, liveWorkers }
`;

export type BulkCapacity = {
  claimed: boolean;
  cap: number;
  occupied: number;
  liveWorkers: number;
};

export type EvaluateBulkCapacityArgs = {
  slotsKey: string;
  presenceKey: string;
  now: number;
  configuredSlots: number | undefined;
  concurrency: number;
  fraction: number;
  member: string;
  leaseTtlMs: number;
};

export const evaluateBulkCapacity = async (
  redis: Pick<Redis, 'eval'>,
  { slotsKey, presenceKey, now, configuredSlots, concurrency, fraction, member, leaseTtlMs }: EvaluateBulkCapacityArgs,
): Promise<BulkCapacity> => {
  const result = (await redis.eval(
    EVALUATE_BULK_CAPACITY,
    2,
    slotsKey,
    presenceKey,
    String(now),
    configuredSlots === undefined ? '' : String(configuredSlots),
    String(concurrency),
    String(fraction),
    member,
    String(now + leaseTtlMs),
    String(leaseTtlMs),
  )) as Array<number | string>;

  return {
    claimed: Number(result[0]) === 1,
    cap: Number(result[1]),
    occupied: Number(result[2]),
    liveWorkers: Number(result[3]),
  };
};
