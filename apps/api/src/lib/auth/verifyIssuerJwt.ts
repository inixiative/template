/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses none
 */
import {
  createLocalJWKSet,
  createRemoteJWKSet,
  decodeJwt,
  errors,
  type JWTPayload,
  type JWTVerifyGetKey,
  jwtVerify,
} from 'jose';
import { onSigningKeyCreated, publicJwks } from '#/lib/auth/jwksStore';
import { PERSON_JWT_TTL_SECONDS, selfIssuer } from '#/lib/auth/personJwt';

type TrustedIssuer = { issuer: string; audience: string; keySet: JWTVerifyGetKey };

const remoteKeySets = new Map<string, JWTVerifyGetKey>();

const remoteKeySet = (jwksUrl: string): JWTVerifyGetKey => {
  const existing = remoteKeySets.get(jwksUrl);
  if (existing) return existing;
  const keySet = createRemoteJWKSet(new URL(jwksUrl), { cacheMaxAge: 10 * 60 * 1000 });
  remoteKeySets.set(jwksUrl, keySet);
  return keySet;
};

const SELF_KEYS_MAX_AGE_MS = 10 * 60 * 1000;
const SELF_KEYS_MIN_RELOAD_MS = 1000;
let selfKeys: { keySet: JWTVerifyGetKey; loadedAt: number } | null = null;
onSigningKeyCreated(() => {
  selfKeys = null;
});

const loadSelfKeys = async (): Promise<JWTVerifyGetKey> => {
  const keySet = createLocalJWKSet(await publicJwks());
  selfKeys = { keySet, loadedAt: Date.now() };
  return keySet;
};

// An unknown kid reloads the keys (another instance rotated), at most once a second.
const selfKeySet: JWTVerifyGetKey = async (protectedHeader, token) => {
  const age = selfKeys ? Date.now() - selfKeys.loadedAt : Number.POSITIVE_INFINITY;
  const keySet = selfKeys && age < SELF_KEYS_MAX_AGE_MS ? selfKeys.keySet : await loadSelfKeys();
  try {
    return await keySet(protectedHeader, token);
  } catch (err) {
    const reloadable = selfKeys && Date.now() - selfKeys.loadedAt >= SELF_KEYS_MIN_RELOAD_MS;
    if (!(err instanceof errors.JWKSNoMatchingKey) || !reloadable) throw err;
    return (await loadSelfKeys())(protectedHeader, token);
  }
};

const trustedIssuers = (): TrustedIssuer[] => {
  const self = selfIssuer();
  const issuers: TrustedIssuer[] = [{ issuer: self, audience: self, keySet: selfKeySet }];
  const { AUTH_ISSUER, AUTH_JWKS_URL, AUTH_AUDIENCE } = process.env;
  if (AUTH_ISSUER && AUTH_JWKS_URL && AUTH_AUDIENCE && AUTH_ISSUER !== self)
    issuers.push({
      issuer: AUTH_ISSUER,
      audience: AUTH_AUDIENCE,
      keySet: remoteKeySet(AUTH_JWKS_URL),
    });
  return issuers;
};

export const verifyIssuerJwt = async (jwt: string): Promise<JWTPayload> => {
  const claimedIssuer = decodeJwt(jwt).iss;
  const trusted = trustedIssuers().find(({ issuer }) => issuer === claimedIssuer);
  if (!trusted)
    throw new errors.JWTClaimValidationFailed('untrusted issuer', {}, 'iss', 'check_failed');
  const { payload } = await jwtVerify(jwt, trusted.keySet, {
    algorithms: ['ES256'],
    issuer: trusted.issuer,
    audience: trusted.audience,
    clockTolerance: 30,
    maxTokenAge: PERSON_JWT_TTL_SECONDS,
    requiredClaims: ['sub', 'exp', 'iat'],
  });
  return payload;
};
