/**
 * @atlas
 * @kind query
 * @partOf infrastructure:redis
 * @uses none
 */
import type { LaneRedis } from '@template/db/lanes/types';

// Fenced release: drop the baton only if WE still hold it (atomic, so a concurrent claim isn't
// clobbered). If our failed claim superseded a previous holder, also clear that tombstone only when
// it still points at us; a later claimant's tombstone is never clobbered.
const FENCED_RELEASE = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  redis.call('del', KEYS[1])
  if ARGV[2] ~= '' then
    local tombstone = ARGV[3] .. ARGV[2]
    if redis.call('get', tombstone) == ARGV[1] then
      redis.call('del', tombstone)
    end
  end
end
return 0
`;

export const fencedRelease = (
  redis: LaneRedis,
  lane: string,
  jobId: string,
  previousHolder: string,
  supersededPrefix: string,
): Promise<unknown> => redis.eval(FENCED_RELEASE, 1, lane, jobId, previousHolder, supersededPrefix);
