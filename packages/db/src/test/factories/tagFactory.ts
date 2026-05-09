import { faker } from '@faker-js/faker';
import { TagResource } from '@template/db/generated/client/enums';
import { createFactory } from '@template/db/test/factory';

const tagFactory = createFactory('Tag', {
  defaults: () => ({
    name: `${faker.word.adjective()}-${faker.string.alphanumeric(6).toLowerCase()}`,
    resources: [],
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

export const buildTag = tagFactory.build;
export const createTag = tagFactory.create;
