/**
 * @atlas
 * @kind service
 * @partOf primitive:authz, primitive:requestContext
 * @uses primitive:authz
 */
import { ActorModel, actorOf, isSuperadmin } from '@template/permissions';
import type { Context } from 'hono';
import { setupPersonPermissions } from '#/lib/permissions/setupPersonPermissions';
import { setupTokenPermissions } from '#/lib/permissions/setupTokenPermissions';
import type { AppEnv } from '#/types/appEnv';

const personHeld = ['User', 'OrganizationUser', 'SpaceUser'];

export const installPermissions = async (c: Context<AppEnv>) => {
  const permix = c.get('permix');
  const user = c.get('user');
  const token = c.get('token');

  await permix.setup([], { replace: true });
  if (token) permix.setActor(actorOf(ActorModel.Token, token));
  else if (user) permix.setActor(actorOf(ActorModel.User, user));
  const heldByPerson = token && personHeld.includes(token.ownerModel) ? token.user : null;
  permix.setSuperadmin(isSuperadmin(user ?? heldByPerson));

  if (token) await setupTokenPermissions(c);
  else await setupPersonPermissions(c);
};
