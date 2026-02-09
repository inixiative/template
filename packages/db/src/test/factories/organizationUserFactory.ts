import { Role } from '@template/db/generated/client/enums';
import { createFactory } from '../factory';
import type { BuildContext, CreateInputOf, TypedBuildResult } from '../factoryTypes';

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

export const createOrganizationUser = (
  overrides?: Partial<CreateInputOf<'OrganizationUser'>>,
  context?: BuildContext,
): Promise<Result> => organizationUserFactory.create(overrides, context) as Promise<Result>;
