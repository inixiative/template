/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { registerFactory } from '@template/db/test/factory';

const sessionFactory = registerFactory('Session', {
  defaults: () => ({
    token: faker.string.alphanumeric(64),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  }),
});

export const buildSession = sessionFactory.build;
export const createSession = sessionFactory.create;
