/**
 * @atlas
 * @kind middleware
 * @partOf feature:auth
 * @uses infrastructure:prisma, primitive:authz, primitive:errors
 */
import type { Context, Next } from 'hono';
import { errors, type JWTPayload } from 'jose';
import { isIssuerJwtEnabled, verifyIssuerJwt } from '#/lib/auth/verifyIssuerJwt';
import { setUserContext } from '#/lib/context/setUserContext';
import { makeError } from '#/lib/errors';
import { findLiveSliceGrant } from '#/modules/inquiry/services/findLiveSliceGrant';
import { findUserWithRelations } from '#/modules/user/services/find';
import type { AppEnv } from '#/types/appEnv';

const jwtShape = /^[\w-]+\.[\w-]+\.[\w-]+$/;

const unauthorized = () => makeError({ status: 401, message: 'Invalid or revoked JWT' });

export const jwtAuthMiddleware = async (c: Context<AppEnv>, next: Next) => {
  if (c.get('user') || !isIssuerJwtEnabled()) return next();

  const authorization = c.req.header('authorization');
  const bearer = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!bearer || !jwtShape.test(bearer)) return next();

  const claims = await verifyIssuerJwt(bearer).catch((err: unknown): JWTPayload | null => {
    const keysUnavailable =
      err instanceof errors.JWKSTimeout ||
      err instanceof errors.JWKSInvalid ||
      (err instanceof errors.JOSEError && err.code === 'ERR_JOSE_GENERIC');
    if (err instanceof errors.JOSEError && !keysUnavailable) return null;
    throw makeError({ status: 503, message: 'JWT issuer keys are unreachable; retry' });
  });
  if (!claims?.sub) throw unauthorized();

  const db = c.get('db');
  const user = await findUserWithRelations(db, claims.sub);
  if (!user) throw unauthorized();

  if (claims.grant !== undefined) {
    if (typeof claims.grant !== 'string') throw unauthorized();
    const sliceGrant = await findLiveSliceGrant(db, claims.grant, user.id);
    if (!sliceGrant) throw unauthorized();
    c.set('slice', sliceGrant);
  }

  await setUserContext(c, user);
  await next();
};
