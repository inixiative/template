/**
 * @atlas
 * @kind query
 * @partOf infrastructure:redis
 * @uses none
 */
import type { RedisEval } from '@template/db/redis/types';

// Runs once the new holder exists. While the lane still names it, the holder it displaced is marked
// superseded on its own record. If a newer claim that exists took the lane first, the new holder marks
// itself. A record that does not exist is never created, and never supersedes anyone.
const MARK_DISPLACED_HOLDER = `
local holder = redis.call('get', KEYS[1])
local me = ARGV[1]
local previous = ARGV[2]
local prefix = ARGV[3]
local field = ARGV[4]
if holder == me then
  if previous ~= '' and previous ~= me and redis.call('exists', prefix .. previous) == 1 then
    redis.call('hset', prefix .. previous, field, me)
  end
elseif holder and redis.call('exists', prefix .. holder) == 1 and redis.call('exists', prefix .. me) == 1 then
  redis.call('hset', prefix .. me, field, holder)
end
return 0
`;

export const markDisplacedHolder = async (
  redis: RedisEval,
  lane: string,
  holderId: string,
  previous: string | null,
  holderKeyPrefix: string,
  supersededField: string,
): Promise<void> => {
  await redis.eval(
    MARK_DISPLACED_HOLDER,
    1,
    lane,
    holderId,
    previous ?? '',
    holderKeyPrefix,
    supersededField,
  );
};
