/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { registerFactory } from '@template/db/test/factory';

const customerRelationshipFactory = registerFactory('CustomerRelationship', {
  defaults: () => ({}),
  dependencies: {
    customerUser: {
      modelName: 'User',
      foreignKey: { id: 'customerUserId' },
      required: false,
    },
    customerOrganization: {
      modelName: 'Organization',
      foreignKey: { id: 'customerOrganizationId' },
      required: false,
    },
    customerSpace: {
      modelName: 'Space',
      foreignKey: { id: 'customerSpaceId' },
      required: false,
    },
    providerUser: {
      modelName: 'User',
      foreignKey: { id: 'providerUserId' },
      required: false,
    },
    providerOrganization: {
      modelName: 'Organization',
      foreignKey: { id: 'providerOrganizationId' },
      required: false,
    },
    providerSpace: {
      modelName: 'Space',
      foreignKey: { id: 'providerSpaceId' },
      required: false,
    },
  },
});

export const buildCustomerRelationship = customerRelationshipFactory.build;
export const createCustomerRelationship = customerRelationshipFactory.create;
