/**
 * @atlas
 * @kind adapter
 * @partOf feature:auth
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { Jwks } from '@template/db/generated/client/client';
import {
  type DecryptFieldInput,
  decryptField,
  encryptField,
} from '@template/db/lib/encryption/helpers';
import type { Jwk } from 'better-auth/plugins';
import type { JSONWebKeySet } from 'jose';
import { USER_JWT_TTL_SECONDS } from '#/lib/auth/userJwt';

const decryptPrivateKey = async (row: Jwks): Promise<string> =>
  (await decryptField('jwks', 'privateKey', {
    ...row,
    encryptedPrivateKeyMetadata: row.encryptedPrivateKeyMetadata as DecryptFieldInput<
      'jwks',
      'privateKey'
    >['encryptedPrivateKeyMetadata'],
  })) as string;

const decrypted = new Map<string, string>();

const privateKeyOf = async (row: Jwks): Promise<string> => {
  const cacheKey = `${row.id}:${row.encryptedPrivateKeyKeyVersion}`;
  const cached = decrypted.get(cacheKey);
  if (cached) return cached;
  const privateKey = await decryptPrivateKey(row);
  decrypted.set(cacheKey, privateKey);
  return privateKey;
};

const toJwk = async (row: Jwks): Promise<Jwk> => ({
  id: row.id,
  createdAt: row.createdAt,
  expiresAt: row.expiresAt ?? undefined,
  alg: row.alg as Jwk['alg'],
  crv: (row.crv ?? undefined) as Jwk['crv'],
  publicKey: row.publicKey,
  privateKey: await privateKeyOf(row),
});

// A key past expiry plus the JWT lifetime can no longer verify anything; it is never read again.
const liveKeysWhere = () => ({
  OR: [
    { expiresAt: null },
    { expiresAt: { gt: new Date(Date.now() - USER_JWT_TTL_SECONDS * 1000) } },
  ],
});

// Better Auth signs with these keys; the private key is encrypted by the template's field encryption.
const selfKeyListeners = new Set<() => void>();

export const onSigningKeyCreated = (listener: () => void) => selfKeyListeners.add(listener);

// What verification needs: the live public keys as a JWKS, read without touching private keys.
export const publicJwks = async (): Promise<JSONWebKeySet> => ({
  keys: (await db.jwks.findMany({ where: liveKeysWhere() })).map((row) => ({
    ...JSON.parse(row.publicKey),
    alg: row.alg,
    kid: row.id,
  })),
});

export const jwksStore = {
  getJwks: async (): Promise<Jwk[]> =>
    Promise.all((await db.jwks.findMany({ where: liveKeysWhere() })).map(toJwk)),
  createJwk: async (key: Omit<Jwk, 'id'>): Promise<Jwk> => {
    const id = Bun.randomUUIDv7();
    const row = await db.jwks.create({
      data: {
        id,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt ?? null,
        alg: key.alg ?? 'ES256',
        crv: key.crv ?? null,
        publicKey: key.publicKey,
        ...(await encryptField('jwks', 'privateKey', { id, privateKey: key.privateKey })),
      },
    });
    for (const listener of selfKeyListeners) listener();
    return toJwk(row);
  },
};
