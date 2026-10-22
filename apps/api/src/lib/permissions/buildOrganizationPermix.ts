/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses none
 */
import type { OrganizationId } from '@template/db';
import { createPermissions, getOrgPermissions, type Permix } from '@template/permissions';

export const buildOrganizationPermix = async (organizationId: string): Promise<Permix> => {
  const permix = createPermissions();
  await permix.setup(getOrgPermissions('owner', organizationId as OrganizationId));
  return permix;
};
