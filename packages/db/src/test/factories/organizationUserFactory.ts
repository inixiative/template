/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { Role } from '@template/db/generated/client/enums';
import {
  type EntitlementsOverride,
  storeEntitlements,
} from '@template/db/test/factories/entitlementFactory';
import { createFactory } from '@template/db/test/factory';
import type { BuildContext, CreateInputOf, TypedBuildResult } from '@template/db/test/factoryTypes';

type Result = TypedBuildResult<'OrganizationUser', ['User', 'Organization']>;

const organizationUserFactory = createFactory('OrganizationUser', {
  defaults: () => ({
    role: Role.member,
  }),
});

export const buildOrganizationUser = (
  overrides?: Partial<CreateInputOf<'OrganizationUser'>>,
  context?: BuildContext,
): Promise<Result> => organizationUserFactory.build(overrides, context) as Promise<Result>;

export const createOrganizationUser = async (
  {
    entitlements,
    ...overrides
  }: Partial<CreateInputOf<'OrganizationUser'>> & EntitlementsOverride = {},
  context?: BuildContext,
): Promise<Result> => {
  const result = (await organizationUserFactory.create(overrides, context)) as Result;
  await storeEntitlements({ model: 'OrganizationUser', id: result.entity.id }, entitlements ?? []);
  return result;
};
