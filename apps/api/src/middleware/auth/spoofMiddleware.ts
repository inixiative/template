import type { Context, Next } from 'hono';

import { isSuperadmin } from '#/lib/context/isSuperadmin';
import { setUserContext } from '#/lib/context/setUserContext';
import { findUserByEmail, findUserWithRelations } from '#/modules/user/services/find';
import { normalizeEmail } from '#/modules/user/utils/normalizeEmail';
import type { AppEnv } from '#/types/appEnv';

export const spoofMiddleware = async (c: Context<AppEnv>, next: Next) => {
  const user = c.get('user');
  if (!user || !isSuperadmin(c)) return next();

  const rawEmail = c.req.header('x-spoof-user-email');
  if (!rawEmail) return next();

  const spoofEmail = normalizeEmail(rawEmail);

  const db = c.get('db');
  const spoofedBasic = await findUserByEmail(db, spoofEmail);
  if (!spoofedBasic) return next();

  const spoofedUser = await findUserWithRelations(db, spoofedBasic.id);
  await setUserContext(c, spoofedUser!);
  c.set('spoofedBy', user);
  c.header('x-spoofing-user-email', user.email);
  c.header('x-spoofed-user-email', spoofEmail);

  await next();
};
