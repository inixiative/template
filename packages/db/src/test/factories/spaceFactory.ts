/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { nextFactorySequenceNumber, registerFactory } from '@template/db/test/factory';

const spaceFactory = registerFactory('Space', {
  defaults: () => ({
    name: faker.company.name(),
    slug: `space-${nextFactorySequenceNumber()}-${faker.string.alphanumeric(6).toLowerCase()}`,
  }),
});

export const buildSpace = spaceFactory.build;
export const createSpace = spaceFactory.create;
