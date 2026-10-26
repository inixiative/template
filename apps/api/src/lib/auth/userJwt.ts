/**
 * @atlas
 * @kind config
 * @partOf feature:auth
 * @uses none
 */
import type { JwtOptions } from 'better-auth/plugins';
import { jwksStore } from '#/lib/auth/jwksStore';

export const USER_JWT_TTL_SECONDS = 30 * 24 * 60 * 60;
const SIGNING_KEY_LIFETIME_SECONDS = 90 * 24 * 60 * 60;

export const selfIssuer = (): string => {
  if (!process.env.API_URL) throw new Error('API_URL is required to issue user JWTs');
  return process.env.API_URL;
};

export const userJwtOptions = (): JwtOptions => ({
  jwks: {
    keyPairConfig: { alg: 'ES256' },
    disablePrivateKeyEncryption: true,
    rotationInterval: SIGNING_KEY_LIFETIME_SECONDS,
    gracePeriod: USER_JWT_TTL_SECONDS,
  },
  adapter: jwksStore,
  jwt: {
    issuer: selfIssuer(),
    audience: selfIssuer(),
    expirationTime: `${USER_JWT_TTL_SECONDS}s`,
  },
  disableSettingJwtHeader: true,
});
