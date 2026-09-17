/**
 * @atlas
 * @kind query
 * @partOf infrastructure:redis
 * @uses none
 */
import type { LaneRedis } from '@template/db/lanes/types';

// Self-heal for the residual expiry window (queue wait > base TTL): when a superseding job STARTS, it
// re-asserts its claim iff the lane is vacant OR held by an OLDER job — never a newer one, so the
// newer-claim-usurps semantics are untouched. jobIds are uuidv7 (time-ordered), so a plain string
// compare is an age compare; a displaced older holder is tombstoned exactly like a claimLane eviction.
// Without the older-holder displacement, two lapsed batons invert the lane: the older queued job
// starts first, re-asserts a vacant lane, and the NEWER job aborts itself as superseded — last-wins
// flips to stale-wins precisely under the congestion this machinery exists for. Callers supplying a
// non-uuidv7 jobId lose the age semantics — the compare stays deterministic but arbitrary.
const AGE_GATED_RECLAIM = `
local holder = redis.call('get', KEYS[1])
if holder and holder >= ARGV[1] then
  return 0
end
redis.call('set', KEYS[1], ARGV[1], 'EX', ARGV[2])
if holder then
  redis.call('set', ARGV[3] .. holder, ARGV[1], 'EX', ARGV[4])
end
return 1
`;

export const ageGatedReclaim = (
  redis: LaneRedis,
  lane: string,
  jobId: string,
  laneTtlSec: number,
  supersededPrefix: string,
  supersededTtlSec: number,
): Promise<unknown> =>
  redis.eval(AGE_GATED_RECLAIM, 1, lane, jobId, String(laneTtlSec), supersededPrefix, String(supersededTtlSec));
