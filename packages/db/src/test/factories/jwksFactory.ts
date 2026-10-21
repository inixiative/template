/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { createFactory } from '@template/db/test/factory';

const jwksFactory = createFactory('Jwks', {
  defaults: () => ({
    alg: 'ES256',
    publicKey: JSON.stringify({ kty: 'EC', crv: 'P-256', x: faker.string.alphanumeric(43) }),
    encryptedPrivateKey: 'test-encrypted-private-key',
    encryptedPrivateKeyMetadata: { iv: 'test-iv', authTag: 'test-auth-tag' },
    encryptedPrivateKeyKeyVersion: 1,
  }),
});

export const buildJwks = jwksFactory.build;
export const createJwks = jwksFactory.create;
