import { OrganizationRole } from '@template/db/generated/client/client';
import { createFactory } from '../factory';

const organizationUserFactory = createFactory('OrganizationUser', {
  defaults: () => ({
    role: OrganizationRole.member,
  }),
});

export const buildOrganizationUser = organizationUserFactory.build;
export const createOrganizationUser = organizationUserFactory.create;
