/**
 * @atlas
 * @kind query
 * @partOf infrastructure:redis
 * @uses none
 */
import type { RedisEval } from '@template/db/redis/types';

// Takes the lane unless a newer holder that still exists holds it. Holder ids are uuidv7, so a string
// compare is an age compare. A holder with no record behind it (an add that failed after its claim)
// counts as no holder.
const CLAIM_UNLESS_NEWER_HOLDER = `
local holder = redis.call('get', KEYS[1])
if holder and holder ~= ARGV[1] and holder > ARGV[1] and redis.call('exists', ARGV[3] .. holder) == 1 then
  return {0, holder}
end
redis.call('set', KEYS[1], ARGV[1], 'EX', ARGV[2])
return {1, holder or ''}
`;

export type LaneClaim = { claimed: boolean; previous: string | null };

export const claimLaneUnlessNewerHolder = async (
  redis: RedisEval,
  lane: string,
  holderId: string,
  laneTtlSec: number,
  holderKeyPrefix: string,
): Promise<LaneClaim> => {
  const [claimed, previous] = (await redis.eval(
    CLAIM_UNLESS_NEWER_HOLDER,
    1,
    lane,
    holderId,
    String(laneTtlSec),
    holderKeyPrefix,
  )) as [number, string];
  return { claimed: claimed === 1, previous: previous || null };
};
