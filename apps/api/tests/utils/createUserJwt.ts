import type { User } from '@template/db/generated/client/client';
import { auth } from '#/lib/auth';
import { userJwtOptions } from '#/lib/auth/userJwt';

// The credential a signed-in user presents: a JWT this API signed, exactly as sign-in returns it.
export const createUserJwt = async (user: User, claims: { ver?: number } = {}) => {
  const payload = {
    sub: user.id,
    ver: claims.ver ?? user.jwtVersion,
    iat: Math.floor(Date.now() / 1000),
  };
  const { jwt } = userJwtOptions();
  const { token } = await auth.api.signJWT({ body: { payload, overrideOptions: { jwt } } });
  return { jwt: token, authorization: `Bearer ${token}` };
};
