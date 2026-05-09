import { faker } from '@faker-js/faker';
import { createFactory } from '@template/db/test/factory';

const tagFactory = createFactory('Tag', {
  defaults: () => ({
    name: `${faker.word.adjective()}-${faker.string.alphanumeric(6).toLowerCase()}`,
    resources: [],
  }),
});

export const buildTag = tagFactory.build;
export const createTag = tagFactory.create;
