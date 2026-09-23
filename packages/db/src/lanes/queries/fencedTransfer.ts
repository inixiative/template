/**
 * @atlas
 * @kind query
 * @partOf infrastructure:redis
 * @uses none
 */
import type { LaneRedis } from '@template/db/lanes/types';

// Hand the baton from one job id to its replacement (a re-buffered job gets a fresh id), but only
// while the old id is not superseded and still holds the lane or the lane is vacant. A newer claimant
// is never displaced: the transfer refuses, and the caller drops the stale job instead of reviving it.
const FENCED_TRANSFER = `
if redis.call('get', ARGV[3] .. ARGV[1]) then
  return 0
end
local holder = redis.call('get', KEYS[1])
if holder and holder ~= ARGV[1] then
  return 0
end
redis.call('set', KEYS[1], ARGV[2], 'EX', ARGV[4])
redis.call('set', ARGV[3] .. ARGV[1], ARGV[2], 'EX', ARGV[5])
return 1
`;

export const fencedTransfer = async (
  redis: LaneRedis,
  lane: string,
  fromJobId: string,
  toJobId: string,
  supersededPrefix: string,
  laneTtlSec: number,
  supersededTtlSec: number,
): Promise<boolean> =>
  (await redis.eval(
    FENCED_TRANSFER,
    1,
    lane,
    fromJobId,
    toJobId,
    supersededPrefix,
    String(laneTtlSec),
    String(supersededTtlSec),
  )) === 1;
