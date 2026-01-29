import type { Context, Next } from 'hono';
import { getUser } from '#/lib/context/getUser';
import { isSuperadmin } from '#/lib/context/isSuperadmin';
import { setUserContext } from '#/lib/context/setUserContext';
import { findUserByEmail, findUserWithOrganizationUsers } from '#/modules/user/services/find';
import { normalizeEmail } from '#/modules/user/utils/normalizeEmail';
import type { AppEnv } from '#/types/appEnv';

export async function spoofMiddleware(c: Context<AppEnv>, next: Next) {
  const user = getUser(c);
  if (!user || !isSuperadmin(c)) return next();

  const rawEmail = c.req.header('spoof-user-email');
  if (!rawEmail) return next();

  const spoofEmail = normalizeEmail(rawEmail);

  const db = c.get('db');
  const spoofedBasic = await findUserByEmail(db, spoofEmail);
  if (!spoofedBasic) return next();

  const spoofedUser = await findUserWithOrganizationUsers(db, spoofedBasic.id);
  await setUserContext(c, spoofedUser!);
  c.set('spoofedBy', user);
  c.header('spoofing-user-email', user.email);
  c.header('spoofed-user-email', spoofEmail);

  await next();
}
