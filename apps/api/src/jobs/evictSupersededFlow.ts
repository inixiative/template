/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import { claimLane, laneKey } from '@template/db';
import { queue } from '#/jobs/queue';
import { readUnfinishedChildren } from '#/jobs/readUnfinishedChildren';
import type { JobsQueue } from '#/jobs/types';

// A staged superseding job has just been replaced by a newer copy, and the old one is parked waiting
// on its children. Those children work for a payload nobody wants any more, so every unfinished child
// is superseded too, running ones included: its lane is claimed as `evicted-<parentId>`, which
// tombstones it. A running child's lane watch aborts it (it stops waiting; its code runs to the end
// but must not write), and a waiting child exits as soon as it starts. Either way it ends normally, so
// the old parent wakes once the last one is done, finds its own tombstone, and exits without `finish`.
// Nothing is removed from the queue: every eviction goes through the lane primitive the children
// already use. Returns how many children it evicted.
export const evictSupersededFlow = async (
  jobId: string,
  jobsQueue: Pick<JobsQueue, 'getJob'> = queue,
): Promise<number> => {
  const parent = await jobsQueue.getJob(jobId);
  if (!parent || (await parent.getState()) !== 'waiting-children') return 0;
  const children = await readUnfinishedChildren(jobsQueue, parent);
  for (const child of children) {
    const { dedupeKey } = child.data;
    if (dedupeKey) await claimLane(laneKey(child.name, dedupeKey), `evicted-${jobId}`);
  }
  return children.length;
};
