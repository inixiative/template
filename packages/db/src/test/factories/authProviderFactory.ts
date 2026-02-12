import { faker } from '@faker-js/faker';
import { AuthProviderType } from '@template/db/generated/client/enums';
import { createFactory } from '@template/db/test/factory';

const authProviderFactory = createFactory('AuthProvider', {
  defaults: () => ({
    type: AuthProviderType.OAUTH,
    provider: `${faker.company.buzzNoun()}-${faker.string.alphanumeric(6)}`,
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
