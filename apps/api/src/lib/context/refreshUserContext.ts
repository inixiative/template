/**
 * @atlas
 * @kind service
 * @partOf primitive:authz, primitive:requestContext
 * @uses infrastructure:prisma, primitive:errors, feature:users
 */
import { fetchOne } from '@template/db';
import type { Token } from '@template/db/generated/client/client';
import type { Context } from 'hono';
import { loadTokenContext } from '#/lib/context/loadTokenContext';
import { setTokenContext } from '#/lib/context/setTokenContext';
import { setUserContext } from '#/lib/context/setUserContext';
import { makeError } from '#/lib/errors';
import { findUserWithRelations } from '#/modules/user/services/find';
import type { AppEnv } from '#/types/appEnv';

export const refreshUserContext = async (c: Context<AppEnv>): Promise<void> => {
  const token = c.get('token');
  if (token) {
    const row = await fetchOne<Token>('token', token.id);
    const context = row ? await loadTokenContext(row) : null;
    if (!context) throw makeError({ status: 401, message: 'Token no longer valid' });
    if (!c.get('spoofedBy')) return setTokenContext(c, context);
  }

  const user = c.get('user');
  if (!user) return;

  const userWithRelations = await findUserWithRelations(user.id);
  if (!userWithRelations) throw makeError({ status: 401, message: 'User no longer exists' });

  await setUserContext(c, userWithRelations);
};
