import { faker } from '@faker-js/faker';
import { createFactory, getNextSeq } from '@template/db/test/factory';

const cronJobFactory = createFactory('CronJob', {
  defaults: () => ({
    name: `cron-job-${getNextSeq()}`,
    jobId: `job-${faker.string.uuid()}`,
    description: faker.lorem.sentence(),
    pattern: '0 0 * * *', // Daily at midnight
    enabled: true,
    handler: 'cleanStaleWebhooks',
    payload: {},
    maxAttempts: 3,
    backoffMs: 5000,
  }),
});

export const buildCronJob = cronJobFactory.build;
export const createCronJob = cronJobFactory.create;
