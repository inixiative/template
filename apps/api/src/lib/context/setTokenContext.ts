/**
 * @atlas
 * @kind service
 * @partOf primitive:authz, primitive:requestContext
 * @uses primitive:authz
 */
import type { Context } from 'hono';
import type { TokenContext } from '#/lib/context/fetchTokenContext';
import { installPermissionsFromRequestContext } from '#/lib/context/installPermissionsFromRequestContext';
import { setMemberContext } from '#/lib/context/setUserContext';
import type { AppEnv } from '#/types/appEnv';

export const setTokenContext = async (c: Context<AppEnv>, { token, user }: TokenContext) => {
  c.set('token', token);
  setMemberContext(c, user);
  await installPermissionsFromRequestContext(c);
};
