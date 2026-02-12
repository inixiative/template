import { faker } from '@faker-js/faker';
import { createFactory, getNextSeq } from '@template/db/test/factory';

const spaceFactory = createFactory('Space', {
  defaults: () => ({
    name: faker.company.name(),
    slug: `space-${getNextSeq()}-${faker.string.alphanumeric(6).toLowerCase()}`,
  }),
});

export const buildSpace = spaceFactory.build;
export const createSpace = spaceFactory.create;
