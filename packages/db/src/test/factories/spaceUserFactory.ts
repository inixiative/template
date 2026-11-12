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

type Result = TypedBuildResult<'SpaceUser', ['User', 'Organization', 'Space', 'OrganizationUser']>;

const spaceUserFactory = createFactory('SpaceUser', {
  defaults: () => ({
    role: Role.member,
  }),
  dependencies: {
    // Composite FK to OrganizationUser
    organizationUser: {
      modelName: 'OrganizationUser',
      foreignKey: { organizationId: 'organizationId', userId: 'userId' },
      required: true,
    },
  },
});

export const buildSpaceUser = (
  overrides?: Partial<CreateInputOf<'SpaceUser'>>,
  context?: BuildContext,
): Promise<Result> => spaceUserFactory.build(overrides, context) as Promise<Result>;

export const createSpaceUser = async (
  { entitlements, ...overrides }: Partial<CreateInputOf<'SpaceUser'>> & EntitlementsOverride = {},
  context?: BuildContext,
): Promise<Result> => {
  const result = (await spaceUserFactory.create(overrides, context)) as Result;
  await storeEntitlements({ model: 'SpaceUser', row: result.entity }, entitlements ?? []);
  return result;
};
