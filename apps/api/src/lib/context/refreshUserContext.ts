/**
 * @atlas
 * @kind service
 * @partOf primitive:authz, primitive:requestContext
 * @uses infrastructure:prisma, primitive:errors, feature:users
 */
import type { Context } from 'hono';
import { setUserContext } from '#/lib/context/setUserContext';
import { makeError } from '#/lib/errors';
import { findUserWithRelations } from '#/modules/user/services/find';
import type { AppEnv } from '#/types/appEnv';

export const refreshUserContext = async (c: Context<AppEnv>): Promise<void> => {
  const user = c.get('user');
  if (!user) return;

  const userWithRelations = await findUserWithRelations(user.id);
  if (!userWithRelations) throw makeError({ status: 401, message: 'User no longer exists' });

  await setUserContext(c, userWithRelations);
};
