/**
 * @atlas
 * @kind middleware
 * @partOf feature:auth, superadmin
 * @uses none
 */
import type { Context, Next } from 'hono';

import { isSuperadmin } from '#/lib/context/isSuperadmin';
import { setUserContext } from '#/lib/context/setUserContext';
import { findUserByEmail, findUserWithRelations } from '#/modules/user/services/find';
import { normalizeEmail } from '#/modules/user/utils/normalizeEmail';
import type { AppEnv } from '#/types/appEnv';

export const spoofMiddleware = async (c: Context<AppEnv>, next: Next) => {
  const spoofer = c.get('user') ?? c.get('token')?.user;
  if (!spoofer || !isSuperadmin(c)) return next();

  const rawEmail = c.req.header('x-spoof-user-email');
  if (!rawEmail) return next();

  const spoofEmail = normalizeEmail(rawEmail);

  const spoofedBasic = await findUserByEmail(spoofEmail);
  if (!spoofedBasic) return next();

  const spoofedUser = await findUserWithRelations(spoofedBasic.id);
  if (!spoofedUser) return next();

  c.set('spoofedBy', spoofer);
  c.set('token', null);
  await setUserContext(c, spoofedUser);
  c.header('x-spoofing-user-email', spoofer.email);
  c.header('x-spoofed-user-email', spoofEmail);

  await next();
};
