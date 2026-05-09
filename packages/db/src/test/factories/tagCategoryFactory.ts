import { faker } from '@faker-js/faker';
import { createFactory } from '@template/db/test/factory';

const tagCategoryFactory = createFactory('TagCategory', {
  defaults: () => ({
    name: `${faker.word.noun()}-${faker.string.alphanumeric(6).toLowerCase()}`,
  }),
});

export const buildTagCategory = tagCategoryFactory.build;
export const createTagCategory = tagCategoryFactory.create;
