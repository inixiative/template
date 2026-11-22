/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { PlatformRole } from '@template/db/generated/client/enums';
import { nextFactorySequenceNumber, registerFactory } from '@template/db/test/factory';

const userFactory = registerFactory('User', {
  defaults: () => ({
    email: `user-${nextFactorySequenceNumber()}@${faker.internet.domainName()}`,
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
