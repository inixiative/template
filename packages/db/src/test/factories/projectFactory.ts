/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { nextFactorySequenceNumber, registerFactory } from '@template/db/test/factory';

const projectFactory = registerFactory('Project', {
  defaults: () => ({
    name: `${faker.commerce.productName()} ${nextFactorySequenceNumber()}`,
  }),
});

export const buildProject = projectFactory.build;
export const createProject = projectFactory.create;
