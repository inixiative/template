/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import { type Job, WaitingChildrenError } from 'bullmq';

// Moves the job to `waiting-children` when it has a child that has not reported, and ends the run with
// WaitingChildrenError so BullMQ runs it again once the last child reports. With no unfinished
// children BullMQ returns false and the run carries on.
export const parkOnUnfinishedChildren = async (job: Job, token: string): Promise<void> => {
  if (await job.moveToWaitingChildren(token)) throw new WaitingChildrenError();
};
