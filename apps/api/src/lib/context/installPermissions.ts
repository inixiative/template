/**
 * @atlas
 * @kind service
 * @partOf primitive:authz, primitive:requestContext
 * @uses primitive:authz
 */
import { ActorModel, isSuperadmin } from '@template/permissions';
import type { Context } from 'hono';
import { setupPersonPermissions } from '#/lib/permissions/setupPersonPermissions';
import { setupTokenPermissions } from '#/lib/permissions/setupTokenPermissions';
import type { AppEnv } from '#/types/appEnv';

/** Rebuilds the request's permission table from its credential, replacing whatever it held. */
export const installPermissions = async (c: Context<AppEnv>) => {
  const permix = c.get('permix');
  const user = c.get('user');
  const token = c.get('token');

  await permix.setup([], { replace: true });
  if (token) permix.setActor({ id: token.id, model: ActorModel.Token });
  else if (user) permix.setActor({ id: user.id, model: ActorModel.User });
  permix.setSuperadmin(user ? isSuperadmin(user) : false);

  if (token) await setupTokenPermissions(c);
  else await setupPersonPermissions(c);
};
