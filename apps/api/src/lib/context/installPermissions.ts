/**
 * @atlas
 * @kind service
 * @partOf primitive:authz, primitive:requestContext
 * @uses primitive:authz
 */
import { TokenScalarSchema } from '@template/db';
import { ActorModel, actorOf, isSuperadmin } from '@template/permissions';
import type { Context } from 'hono';
import { pick } from 'lodash-es';
import { me } from '#/lib/context/me';
import { setupPersonPermissions } from '#/lib/permissions/setupPersonPermissions';
import { setupTokenPermissions } from '#/lib/permissions/setupTokenPermissions';
import type { AppEnv } from '#/types/appEnv';

const tokenColumns = Object.keys(TokenScalarSchema.shape);

export const installPermissions = async (c: Context<AppEnv>) => {
  const permix = c.get('permix');
  const user = c.get('user');
  const token = c.get('token');

  await permix.setup([], { replace: true });
  if (token) permix.setActor(actorOf(ActorModel.Token, pick(token, tokenColumns)));
  else if (user) permix.setActor(actorOf(ActorModel.User, user));
  permix.setSuperadmin(isSuperadmin(me(c)));

  if (token) await setupTokenPermissions(c);
  else await setupPersonPermissions(c);
};
