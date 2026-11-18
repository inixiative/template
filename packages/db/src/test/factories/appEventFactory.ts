/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { registerFactory } from '@template/db/test/factory';

const appEventFactory = registerFactory('AppEvent', {
  defaults: () => ({
    name: faker.word.noun(),
  }),
});

export const buildAppEvent = appEventFactory.build;
export const createAppEvent = appEventFactory.create;
