import { Role } from '@template/db/generated/client/enums';
import { createFactory } from '../factory';
import type { BuildContext, CreateInputOf, TypedBuildResult } from '../factoryTypes';

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

export const createSpaceUser = (
  overrides?: Partial<CreateInputOf<'SpaceUser'>>,
  context?: BuildContext,
): Promise<Result> => spaceUserFactory.create(overrides, context) as Promise<Result>;
