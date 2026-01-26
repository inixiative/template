import { faker } from '@faker-js/faker';
import { createFactory } from '../factory';

const sessionFactory = createFactory('Session', {
  defaults: () => ({
    token: faker.string.alphanumeric(64),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  }),
});

export const buildSession = sessionFactory.build;
export const createSession = sessionFactory.create;
