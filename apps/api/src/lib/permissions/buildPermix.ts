/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses none
 */
import {
  ActorModel,
  buildActor,
  createPermissions,
  isSuperadmin,
  type Permix,
} from '@template/permissions';
import type { PermissionPrincipal } from '#/lib/permissions/permissionPrincipal';
import { setupOrgPermissions } from '#/lib/permissions/setupOrgPermissions';
import { setupSpacePermissions } from '#/lib/permissions/setupSpacePermissions';
import { setupUserPermissions } from '#/lib/permissions/setupUserPermissions';

export const buildPermix = async (principal: PermissionPrincipal): Promise<Permix> => {
  const permix = createPermissions();
  const { user, token, grant } = principal;
  const actorId = user?.id ?? token?.id;
  if (actorId) {
    const model = token ? ActorModel.Token : grant ? ActorModel.Inquiry : ActorModel.User;
    permix.setActor(buildActor(actorId, model, grant));
  }
  if (user) permix.setSuperadmin(isSuperadmin(user));
  await setupUserPermissions(permix, principal);
  await setupOrgPermissions(permix, principal);
  await setupSpacePermissions(permix, principal);
  return permix;
};
