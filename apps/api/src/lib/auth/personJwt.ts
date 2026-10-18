/**
 * @atlas
 * @kind config
 * @partOf feature:auth
 * @uses none
 */
import type { JwtOptions } from 'better-auth/plugins';
import { jwksStore } from '#/lib/auth/jwksStore';

export const PERSON_JWT_TTL_SECONDS = 30 * 24 * 60 * 60;
const SIGNING_KEY_LIFETIME_SECONDS = 90 * 24 * 60 * 60;

export const selfIssuer = (): string => {
  if (!process.env.API_URL) throw new Error('API_URL is required to issue person JWTs');
  return process.env.API_URL;
};

export const personJwtOptions = (): JwtOptions => ({
  jwks: {
    keyPairConfig: { alg: 'ES256' },
    disablePrivateKeyEncryption: true,
    rotationInterval: SIGNING_KEY_LIFETIME_SECONDS,
    gracePeriod: PERSON_JWT_TTL_SECONDS,
  },
  adapter: jwksStore,
  jwt: {
    issuer: selfIssuer(),
    audience: selfIssuer(),
    expirationTime: `${PERSON_JWT_TTL_SECONDS}s`,
  },
  disableSettingJwtHeader: true,
});
