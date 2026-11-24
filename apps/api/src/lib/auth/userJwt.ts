/**
 * @atlas
 * @kind config
 * @partOf feature:auth
 * @uses none
 */
import type { JwtOptions } from 'better-auth/plugins';
import { jwksStore } from '#/lib/auth/jwksStore';

export const USER_JWT_TTL_SECONDS = 30 * 24 * 60 * 60;
export const PRE_TWO_FACTOR_JWT_TTL_SECONDS = 15 * 60;
export const TWO_FACTOR_REVERIFY_TTL_SECONDS = 15 * 60;
const SIGNING_KEY_LIFETIME_SECONDS = 90 * 24 * 60 * 60;

export const userJwtIssuerUrlOrThrow = (): string => {
  if (!process.env.API_URL) throw new Error('API_URL is required to issue user JWTs');
  return process.env.API_URL;
};

export const userJwtOptions = (ttlSeconds = USER_JWT_TTL_SECONDS): JwtOptions => ({
  jwks: {
    keyPairConfig: { alg: 'ES256' },
    disablePrivateKeyEncryption: true,
    rotationInterval: SIGNING_KEY_LIFETIME_SECONDS,
    gracePeriod: USER_JWT_TTL_SECONDS,
  },
  adapter: jwksStore,
  jwt: {
    issuer: userJwtIssuerUrlOrThrow(),
    audience: userJwtIssuerUrlOrThrow(),
    expirationTime: `${ttlSeconds}s`,
  },
  disableSettingJwtHeader: true,
});
