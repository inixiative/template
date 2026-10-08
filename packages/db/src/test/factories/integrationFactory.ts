/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { createFactory } from '@template/db/test/factory';

const integrationFactory = createFactory('Integration', {
  defaults: () => ({
    name: faker.company.name(),
  }),
});

export const buildIntegration = integrationFactory.build;
export const createIntegration = integrationFactory.create;
