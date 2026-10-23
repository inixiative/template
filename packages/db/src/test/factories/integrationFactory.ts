/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { createFactory, getNextSeq } from '@template/db/test/factory';

const integrationFactory = createFactory('Integration', {
  defaults: () => ({
    name: `${faker.company.name()} ${getNextSeq()}`,
  }),
});

export const buildIntegration = integrationFactory.build;
export const createIntegration = integrationFactory.create;
