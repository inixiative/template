/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { nextFactorySequenceNumber, registerFactory } from '@template/db/test/factory';

const integrationResourceFactory = registerFactory('IntegrationResource', {
  defaults: () => ({
    name: faker.company.name(),
    kind: 'channel',
    externalId: `${faker.string.alphanumeric(12)}-${nextFactorySequenceNumber()}`,
    metadata: {},
  }),
});

export const buildIntegrationResource = integrationResourceFactory.build;
export const createIntegrationResource = integrationResourceFactory.create;
