/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { createFactory } from '@template/db/test/factory';

const appEventFactory = createFactory('AppEvent', {
  defaults: () => ({
    name: faker.word.noun(),
  }),
});

export const buildAppEvent = appEventFactory.build;
export const createAppEvent = appEventFactory.create;
