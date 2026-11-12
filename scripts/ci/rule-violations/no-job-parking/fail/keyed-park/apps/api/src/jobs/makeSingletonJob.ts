import { DelayedError, type Job } from 'bullmq';

export const parkKeyedRun = async (job: Job): Promise<never> => {
  await job.moveToDelayed(Date.now() + 1_000, job.token);
  throw new DelayedError();
};
