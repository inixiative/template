/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { faker } from '@faker-js/faker';
import {
  type EntitlementsOverride,
  storeEntitlements,
} from '@template/db/test/factories/entitlementFactory';
import { nextFactorySequenceNumber, registerFactory } from '@template/db/test/factory';
import type { BuildContext, CreateInputOf } from '@template/db/test/factoryTypes';

const integrationFactory = registerFactory('Integration', {
  defaults: () => ({
    name: `${faker.company.name()} ${nextFactorySequenceNumber()}`,
    role: 'viewer' as const,
  }),
});

export const buildIntegration = integrationFactory.build;
export const createIntegration = async (
  { entitlements, ...overrides }: Partial<CreateInputOf<'Integration'>> & EntitlementsOverride = {},
  context?: BuildContext,
) => {
  const result = await integrationFactory.create(overrides, context);
  await storeEntitlements({ model: 'Integration', row: result.entity }, entitlements ?? []);
  return result;
};
