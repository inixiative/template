/**
 * @atlas
 * @kind middleware
 * @partOf feature:auth
 * @uses infrastructure:prisma, infrastructure:redis, primitive:errors
 */
import type { Context, Next } from 'hono';
import { errors, type JWTPayload } from 'jose';
import { jwtValidAfter } from '#/lib/auth/jwtRevocation';
import { verifyIssuerJwt } from '#/lib/auth/verifyIssuerJwt';
import { setUserContext } from '#/lib/context/setUserContext';
import { makeError } from '#/lib/errors';
import { findUserWithRelations } from '#/modules/user/services/find';
import type { AppEnv } from '#/types/appEnv';

const jwtShape = /^[\w-]+\.[\w-]+\.[\w-]+$/;

const unauthorized = () => makeError({ status: 401, message: 'Invalid or revoked JWT' });

const isKeysUnavailable = (err: unknown) =>
  err instanceof errors.JWKSTimeout ||
  err instanceof errors.JWKSInvalid ||
  (err instanceof errors.JOSEError && err.code === 'ERR_JOSE_GENERIC');

export const jwtAuthMiddleware = async (c: Context<AppEnv>, next: Next) => {
  if (c.get('user')) return next();

  const authorization = c.req.header('authorization');
  const bearer = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!bearer || !jwtShape.test(bearer)) return next();

  const claims = await verifyIssuerJwt(bearer).catch((err: unknown): JWTPayload | null => {
    if (err instanceof errors.JOSEError && !isKeysUnavailable(err)) return null;
    throw makeError({ status: 503, message: 'JWT issuer keys are unreachable; retry' });
  });
  if (!claims?.sub || typeof claims.iat !== 'number') throw unauthorized();

  const validAfter = await jwtValidAfter(claims.sub).catch(() => {
    throw makeError({ status: 503, message: 'JWT revocation state is unreachable; retry' });
  });
  if (validAfter !== null && claims.iat <= validAfter) throw unauthorized();

  const user = await findUserWithRelations(claims.sub);
  if (!user) throw unauthorized();

  await setUserContext(c, user);
  await next();
};
