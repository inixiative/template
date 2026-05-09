import { faker } from '@faker-js/faker';
import { TagResource } from '@template/db/generated/client/enums';
import { createFactory } from '@template/db/test/factory';

const tagCategoryFactory = createFactory('TagCategory', {
  defaults: () => ({
    name: `${faker.word.noun()}-${faker.string.alphanumeric(6).toLowerCase()}`,
    ownerModel: TagResource.platform,
  }),
  dependencies: {
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

export const buildTagCategory = tagCategoryFactory.build;
export const createTagCategory = tagCategoryFactory.create;
