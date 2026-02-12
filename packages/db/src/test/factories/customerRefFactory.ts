import { createFactory } from '@template/db/test/factory';

const customerRefFactory = createFactory('CustomerRef', {
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
    providerSpace: {
      modelName: 'Space',
      foreignKey: { id: 'providerSpaceId' },
      required: false,
    },
  },
});

export const buildCustomerRef = customerRefFactory.build;
export const createCustomerRef = customerRefFactory.create;
