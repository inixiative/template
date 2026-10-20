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
import type { Principal } from '#/lib/context/getPrincipal';
import { setupGrantPermissions } from '#/lib/permissions/setupGrantPermissions';
import { setupOwnerTokenPermissions } from '#/lib/permissions/setupOwnerTokenPermissions';
import { setupPersonPermissions } from '#/lib/permissions/setupPersonPermissions';

export const buildPermix = async (principal: Principal): Promise<Permix> => {
  const permix = createPermissions();
  const { user, token, grant } = principal;
  const actorId = user?.id ?? token?.id;
  if (actorId) {
    const model = token ? ActorModel.Token : grant ? ActorModel.Inquiry : ActorModel.User;
    permix.setActor(buildActor(actorId, model, grant));
  }
  if (!user) {
    if (token) await setupOwnerTokenPermissions(permix, token);
    return permix;
  }
  permix.setSuperadmin(isSuperadmin(user));
  if (!grant) {
    await setupPersonPermissions(permix, user);
    return permix;
  }
  const holder = await buildPermix({ user, token: null, grant: null });
  await setupGrantPermissions(permix, holder, user, token, grant);
  return permix;
};
