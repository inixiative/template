/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { createFactory } from '@template/db/test/factory';

const accountFactory = createFactory('Account', {
  defaults: () => ({
    accountId: faker.string.uuid(),
    providerId: 'credential',
  }),
});

export const buildAccount = accountFactory.build;
export const createAccount = accountFactory.create;
