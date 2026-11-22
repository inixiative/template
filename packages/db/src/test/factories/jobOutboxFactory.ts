/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { registerFactory } from '@template/db/test/factory';

const jobOutboxFactory = registerFactory('JobOutbox', {
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
