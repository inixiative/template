import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Db } from '@template/db';
import { findUserWithRelations } from '#/modules/user/services/find';
import { setUserContext } from './setUserContext';
import type { AppEnv } from '#/types/appEnv';

export const refreshUserContext = async (c: Context<AppEnv>, db: Db): Promise<void> => {
  const user = c.get('user');
  if (!user) return;

  const permix = c.get('permix');
  await permix.setup([], { replace: true });

  const userWithRelations = await findUserWithRelations(db, user.id);
  if (!userWithRelations) throw new HTTPException(401, { message: 'User no longer exists' });

  await setUserContext(c, userWithRelations);
};
