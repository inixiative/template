/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { createFactory } from '@template/db/test/factory';

const verificationFactory = createFactory('Verification', {
  defaults: () => ({
    identifier: faker.internet.email(),
    value: faker.string.alphanumeric(32),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  }),
});

export const buildVerification = verificationFactory.build;
export const createVerification = verificationFactory.create;
