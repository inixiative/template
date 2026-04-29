import { faker } from '@faker-js/faker';
import { ContactOwnerModel, ContactType } from '@template/db/generated/client/enums';
import { createFactory } from '@template/db/test/factory';

const contactFactory = createFactory('Contact', {
  defaults: () => ({
    ownerModel: ContactOwnerModel.User,
    type: ContactType.email,
    value: { address: faker.internet.email().toLowerCase() },
    isPrimary: false,
  }),
  dependencies: {
    // Pass an empty object in overrides to trigger auto-create of the owner.
    // Format: { targetField: sourceField } — read targetField from dep, set sourceField on Contact.
    user: {
      modelName: 'User',
      foreignKey: { id: 'userId' },
      required: false,
    },
    organization: {
      modelName: 'Organization',
      foreignKey: { id: 'organizationId' },
      required: false,
    },
    space: {
      modelName: 'Space',
      foreignKey: { id: 'spaceId' },
      required: false,
    },
  },
});

export const buildContact = contactFactory.build;
export const createContact = contactFactory.create;
