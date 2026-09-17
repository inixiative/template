/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { createFactory } from '@template/db/test/factory';

const jobOutboxFactory = createFactory('JobOutbox', {
  defaults: () => ({
    handlerName: 'sendWebhook',
    jobId: faker.string.uuid(),
    dedupeKey: null,
    data: {},
    options: {},
    attempts: 0,
  }),
});

export const buildJobOutbox = jobOutboxFactory.build;
export const createJobOutbox = jobOutboxFactory.create;
