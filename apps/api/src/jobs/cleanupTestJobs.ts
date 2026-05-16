import { LogScope, log } from '@template/shared/logger';
import { queue } from '#/jobs/queue';

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
        log.warn(`Failed to remove test job ${job.id}`, LogScope.test);
      }
    }
  }

  if (totalCleaned > 0) {
    log.info(`Cleaned up ${totalCleaned} test jobs`, LogScope.test);
  }

  return totalCleaned;
};
