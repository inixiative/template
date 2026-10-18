import type { User } from '@template/db/generated/client/client';
import { auth } from '#/lib/auth';

// The credential a signed-in person presents: a JWT this API signed, exactly as sign-in returns it.
export const createUserJwt = async (user: User, claims: { iat?: number } = {}) => {
  const iat = claims.iat ?? Math.floor(Date.now() / 1000);
  const { token } = await auth.api.signJWT({ body: { payload: { sub: user.id, iat } } });
  return { jwt: token, authorization: `Bearer ${token}` };
};
