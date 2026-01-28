import { OrganizationRole } from '@template/db/generated/client/client';
import type { BuildContext, CreateInputOf, TypedBuildResult } from '../factoryTypes';
import { createFactory } from '../factory';

type Result = TypedBuildResult<'OrganizationUser', ['User', 'Organization']>;

const organizationUserFactory = createFactory('OrganizationUser', {
  defaults: () => ({
    role: OrganizationRole.member,
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
