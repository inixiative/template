/**
 * @atlas
 * @kind service
 * @partOf primitive:websockets
 * @uses feature:auth, feature:users, infrastructure:prisma
 */
import { db } from '@template/db';
import { auth } from '#/lib/auth';
import { findUserByEmail, findUserWithRelations } from '#/modules/user/services/find';
import { normalizeEmail } from '#/modules/user/utils/normalizeEmail';

// Resolve the real user behind a session token (better-auth), mirroring authMiddleware.
const userFromToken = async (token: string) => {
  const headers = new Headers({ authorization: `Bearer ${token}` });
  const session = await auth.api.getSession({ headers });
  if (!session?.user?.id) return null;
  return findUserWithRelations(db, session.user.id);
};

// authenticate / unspoof: token → real userId, or null when the token is invalid.
export const authenticateToken = async (token: string): Promise<string | null> => {
  const user = await userFromToken(token);
  return user?.id ?? null;
};

// spoof: only a superadmin may spoof; the target is resolved by email (mirrors
// spoofMiddleware). Returns the spoofed userId, or null if the requester isn't a
// superadmin or the email is unknown.
export const resolveSpoofTarget = async (token: string, email: string): Promise<string | null> => {
  const actor = await userFromToken(token);
  if (actor?.platformRole !== 'superadmin') return null;
  const target = await findUserByEmail(db, normalizeEmail(email));
  return target?.id ?? null;
};
