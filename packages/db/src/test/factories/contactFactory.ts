import { faker } from '@faker-js/faker';
import { ContactOwnerModel, ContactType } from '@template/db/generated/client/enums';
import { createFactory } from '@template/db/test/factory';

const contactFactory = createFactory('Contact', {
  defaults: () => ({
    ownerModel: ContactOwnerModel.User,
    type: ContactType.email,
    value: { address: faker.internet.email().toLowerCase() },
    isPrimary: false,
    isPublic: false,
  }),
});

export const buildContact = contactFactory.build;
export const createContact = contactFactory.create;
