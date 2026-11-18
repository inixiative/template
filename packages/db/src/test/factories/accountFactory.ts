/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { registerFactory } from '@template/db/test/factory';

const accountFactory = registerFactory('Account', {
  defaults: () => ({
    accountId: faker.string.uuid(),
    providerId: 'credential',
  }),
});

export const buildAccount = accountFactory.build;
export const createAccount = accountFactory.create;
