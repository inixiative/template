/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { nextFactorySequenceNumber, registerFactory } from '@template/db/test/factory';

const cronJobFactory = registerFactory('CronJob', {
  defaults: () => ({
    name: `cron-job-${nextFactorySequenceNumber()}`,
    jobId: `job-${faker.string.uuid()}`,
    description: faker.lorem.sentence(),
    pattern: '0 0 * * *', // Daily at midnight
    enabled: true,
    handler: 'hardDeleteRecordsPastRetention',
    payload: { model: 'WebhookEvent', retentionDays: 90 },
    maxAttempts: 3,
    backoffMs: 5000,
  }),
});

export const buildCronJob = cronJobFactory.build;
export const createCronJob = cronJobFactory.create;
