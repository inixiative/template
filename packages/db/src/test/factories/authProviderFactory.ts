/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { AuthProviderType } from '@template/db/generated/client/enums';
import { nextFactorySequenceNumber, registerFactory } from '@template/db/test/factory';

const authProviderFactory = registerFactory('AuthProvider', {
  defaults: () => ({
    type: AuthProviderType.OAUTH,
    provider: `${faker.company.buzzNoun()}-${faker.string.alphanumeric(6)}-${nextFactorySequenceNumber()}`,
    name: faker.company.name(),
    enabled: true,
    config: {},
    encryptedSecrets: 'test-encrypted-secrets',
    encryptedSecretsMetadata: { iv: 'test-iv', authTag: 'test-auth-tag' },
    encryptedSecretsKeyVersion: 1,
  }),
});

export const buildAuthProvider = authProviderFactory.build;
export const createAuthProvider = authProviderFactory.create;
