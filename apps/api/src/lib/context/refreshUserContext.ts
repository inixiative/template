import type { Db } from '@template/db';
import type { Context } from 'hono';
import { makeError } from '#/lib/errors';
import { setUserContext } from '#/lib/context/setUserContext';
import { findUserWithRelations } from '#/modules/user/services/find';
import type { AppEnv } from '#/types/appEnv';

export const refreshUserContext = async (c: Context<AppEnv>, db: Db): Promise<void> => {
  const user = c.get('user');
  if (!user) return;

  const permix = c.get('permix');
  await permix.setup([], { replace: true });

  const userWithRelations = await findUserWithRelations(db, user.id);
  if (!userWithRelations) throw makeError({ status: 401, message: 'User no longer exists', requestId: c.get('requestId') });

  await setUserContext(c, userWithRelations);
};
