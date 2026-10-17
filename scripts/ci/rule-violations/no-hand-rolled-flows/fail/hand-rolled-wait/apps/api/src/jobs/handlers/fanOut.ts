import { type Job, WaitingChildrenError } from 'bullmq';

export const fanOut = async (job: Job): Promise<void> => {
  if (await job.moveToWaitingChildren(job.token ?? '')) throw new WaitingChildrenError();
};
