import { faker } from '@faker-js/faker';
import { PlatformRole } from '@template/db/generated/client/client';
import { createFactory, getNextSeq } from '../factory';

const userFactory = createFactory('User', {
  defaults: () => ({
    email: `user-${getNextSeq()}@${faker.internet.domainName()}`,
    emailVerified: true,
    name: faker.person.fullName(),
    image: faker.image.avatar(),
    platformRole: PlatformRole.user,
  }),
});

export const buildUser = userFactory.build;
export const createUser = userFactory.create;
