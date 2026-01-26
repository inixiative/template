import { faker } from '@faker-js/faker';
import { createFactory, getNextSeq } from '../factory';

const organizationFactory = createFactory('Organization', {
  defaults: () => ({
    name: faker.company.name(),
    slug: `org-${getNextSeq()}-${faker.string.alphanumeric(6).toLowerCase()}`,
  }),
});

export const buildOrganization = organizationFactory.build;
export const createOrganization = organizationFactory.create;
