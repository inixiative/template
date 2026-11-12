/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { PlatformRole } from '@template/db/generated/client/enums';
import { createFactory, getNextSeq } from '@template/db/test/factory';

const userFactory = createFactory('User', {
  defaults: () => ({
    email: `user-${getNextSeq()}@${faker.internet.domainName()}`,
    emailVerified: true,
    name: faker.person.fullName(),
    displayName: null,
    image: faker.image.avatar(),
    platformRole: PlatformRole.user,
    lastLoginAt: null,
    jwtVersion: 0,
  }),
});

export const buildUser = userFactory.build;
export const createUser = userFactory.create;
