/**
 * @atlas
 * @kind service
 * @partOf primitive:authz, primitive:requestContext
 * @uses primitive:authz
 */
import type { Context } from 'hono';
import { installPermissions } from '#/lib/context/installPermissions';
import type { TokenContext } from '#/lib/context/loadTokenContext';
import { setUserContext } from '#/lib/context/setUserContext';
import type { AppEnv } from '#/types/appEnv';

export const setTokenContext = async (c: Context<AppEnv>, { token, holder }: TokenContext) => {
  c.set('token', token);
  if (holder) await setUserContext(c, holder);
  else await installPermissions(c);
};
