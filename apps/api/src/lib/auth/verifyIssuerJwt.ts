/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses none
 */
import { createRemoteJWKSet, type JWTPayload, type JWTVerifyGetKey, jwtVerify } from 'jose';

const keySets = new Map<string, JWTVerifyGetKey>();

const issuerKeySet = (jwksUrl: string): JWTVerifyGetKey => {
  const existing = keySets.get(jwksUrl);
  if (existing) return existing;
  const keySet = createRemoteJWKSet(new URL(jwksUrl), { cacheMaxAge: 10 * 60 * 1000 });
  keySets.set(jwksUrl, keySet);
  return keySet;
};

export const isIssuerJwtEnabled = (): boolean =>
  !!process.env.AUTH_ISSUER && !!process.env.AUTH_JWKS_URL && !!process.env.AUTH_AUDIENCE;

export const verifyIssuerJwt = async (jwt: string): Promise<JWTPayload> => {
  const { AUTH_ISSUER, AUTH_JWKS_URL, AUTH_AUDIENCE } = process.env;
  if (!AUTH_ISSUER || !AUTH_JWKS_URL || !AUTH_AUDIENCE)
    throw new Error('Issuer JWTs are not configured');
  const { payload } = await jwtVerify(jwt, issuerKeySet(AUTH_JWKS_URL), {
    algorithms: ['ES256'],
    issuer: AUTH_ISSUER,
    audience: AUTH_AUDIENCE,
    clockTolerance: 30,
    requiredClaims: ['sub', 'exp'],
  });
  return payload;
};
