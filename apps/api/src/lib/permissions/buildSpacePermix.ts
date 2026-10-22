/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses none
 */
import type { SpaceId } from '@template/db';
import { createPermissions, getSpacePermissions, type Permix } from '@template/permissions';

export const buildSpacePermix = async (spaceId: string): Promise<Permix> => {
  const permix = createPermissions();
  await permix.setup(getSpacePermissions('owner', spaceId as SpaceId));
  return permix;
};
