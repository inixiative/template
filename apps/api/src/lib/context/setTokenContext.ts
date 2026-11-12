/**
 * @atlas
 * @kind service
 * @partOf primitive:authz, primitive:requestContext
 * @uses primitive:authz
 */
import type { Context } from 'hono';
import { installPermissions } from '#/lib/context/installPermissions';
import type { TokenContext } from '#/lib/context/loadTokenContext';
import { setMemberContext } from '#/lib/context/setUserContext';
import type { AppEnv } from '#/types/appEnv';

export const setTokenContext = async (c: Context<AppEnv>, { token, user }: TokenContext) => {
  c.set('token', token);
  setMemberContext(c, user);
  await installPermissions(c);
};
