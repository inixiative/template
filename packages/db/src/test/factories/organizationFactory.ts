/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { nextFactorySequenceNumber, registerFactory } from '@template/db/test/factory';

const organizationFactory = registerFactory('Organization', {
  defaults: () => ({
    name: faker.company.name(),
    slug: `org-${nextFactorySequenceNumber()}-${faker.string.alphanumeric(6).toLowerCase()}`,
  }),
});

export const buildOrganization = organizationFactory.build;
export const createOrganization = organizationFactory.create;
