/**
 * @atlas
 * @kind query
 * @partOf infrastructure:redis
 * @uses none
 */
import type { LaneRedis } from '@template/db/lanes/types';

// Take the baton: record jobId as the lane's holder, evicting whoever held it (last claim wins).
// The claim happens at ENQUEUE time but is only refreshed by watchLane once the job RUNS, so the TTL
// must cover the whole off-worker window: any scheduled `delay` (measured from enqueue) plus the base
// TTL as the queue-wait buffer. A baton that expires before its job starts reads as "no active
// claimant" to an older in-flight job — the usurp is missed and stale superseded work keeps running.
//
// The per-job superseded marker is the durable edge: if job A is queued, job B claims the lane, and
// the lane TTL expires before A starts, A still finds `superseded:A = B` and exits instead of
// resurrecting stale work.
const EVICTING_CLAIM = `
local previous = redis.call('get', KEYS[1])
redis.call('set', KEYS[1], ARGV[1], 'EX', ARGV[2])
if previous and previous ~= ARGV[1] then
  redis.call('set', ARGV[3] .. previous, ARGV[1], 'EX', ARGV[4])
end
return previous
`;

export const evictingClaim = async (
  redis: LaneRedis,
  lane: string,
  jobId: string,
  laneTtlSec: number,
  supersededPrefix: string,
  supersededTtlSec: number,
): Promise<string | null> => {
  const previous = await redis.eval(
    EVICTING_CLAIM,
    1,
    lane,
    jobId,
    String(laneTtlSec),
    supersededPrefix,
    String(supersededTtlSec),
  );
  return typeof previous === 'string' ? previous : null;
};
