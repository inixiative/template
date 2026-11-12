import { type Job, WaitingChildrenError } from 'bullmq';

export const parkUntilChildrenReport = async (job: Job, token: string): Promise<void> => {
  if (await job.moveToWaitingChildren(token)) throw new WaitingChildrenError();
};

export const childOptions = { ignoreDependencyOnFailure: true };
