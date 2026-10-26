/**
 * @atlas
 * @kind service
 * @partOf primitive:authz, primitive:requestContext
 * @uses primitive:authz
 */
import { ActorModel, actorOf, isSuperadmin } from '@template/permissions';
import type { Context } from 'hono';
import { me } from '#/lib/context/me';
import { setupTokenPermissions } from '#/lib/permissions/setupTokenPermissions';
import { setupUserPermissions } from '#/lib/permissions/setupUserPermissions';
import { installUserPermissions } from '#/lib/permissions/userPermissions';
import type { AppEnv } from '#/types/appEnv';

export const installPermissions = async (c: Context<AppEnv>) => {
  const permix = c.get('permix');
  const user = c.get('user');
  const token = c.get('token');

  if (!token && user)
    return installUserPermissions(permix, user, {
      organizationUsers: c.get('organizationUsers') ?? [],
      spaceUsers: c.get('spaceUsers') ?? [],
    });

  await permix.setup([], { replace: true });
  if (token) permix.setActor(actorOf(ActorModel.Token, token));
  else if (user) permix.setActor(actorOf(ActorModel.User, user));
  permix.setSuperadmin(isSuperadmin(me(c)));

  if (token) await setupTokenPermissions(c);
  else await setupUserPermissions(c);
};
