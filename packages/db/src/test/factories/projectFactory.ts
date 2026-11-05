/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { createFactory, getNextSeq } from '@template/db/test/factory';

const projectFactory = createFactory('Project', {
  defaults: () => ({
    name: `${faker.commerce.productName()} ${getNextSeq()}`,
  }),
});

export const buildProject = projectFactory.build;
export const createProject = projectFactory.create;
