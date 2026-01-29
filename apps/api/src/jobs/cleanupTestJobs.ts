import { queue } from '#/jobs/queue';
import { log } from '@template/shared/logger';

export const cleanupTestJobs = async (): Promise<number> => {
  const jobStates = ['completed', 'failed', 'wait', 'active', 'delayed'] as const;
  let totalCleaned = 0;

  for (const state of jobStates) {
    const jobs = await queue.getJobs([state]);
    const testJobs = jobs.filter((job) => job.id?.startsWith('test-'));

    for (const job of testJobs) {
      try {
        await job.remove();
        totalCleaned++;
      } catch {
        log.warn(`Failed to remove test job ${job.id}`);
      }
    }
  }

  if (totalCleaned > 0) {
    log.info(`Cleaned up ${totalCleaned} test jobs`);
  }

  return totalCleaned;
};
