/**
 * @atlas
 * @kind config
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import type { LaneStore } from '@template/db';
import { queue } from '#/jobs/queue';

export const jobLaneStore: LaneStore = {
  redis: queue.redis,
  holderKeyPrefix: queue.toKey(''),
  supersededField: 'supersededBy',
};
