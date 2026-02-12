import { upperFirst } from 'lodash';
import type { AuthProvider } from '@template/db/generated/client/client';
import type { EncryptedModelConfig } from '@template/db/lib/encryption/types';

export const ENCRYPTED_MODELS = {
  authProvider: {
    model: 'authProvider',
    keys: {
      secrets: {
        envPrefix: 'AUTH_PROVIDER_SECRETS',
        buildAAD: (r: Pick<AuthProvider, 'id' | 'organizationId'>) =>
          `authProvider:${r.id}:${r.organizationId}`,
      },
    },
  } satisfies EncryptedModelConfig<'authProvider'>,
} as const;

// Helper to derive field names from key name
export const getFieldNames = (keyName: string) => {
  const pascal = upperFirst(keyName);
  return {
    encryptedField: `encrypted${pascal}`,
    metadataField: `encrypted${pascal}Metadata`,
    versionField: `encrypted${pascal}KeyVersion`,
  };
};
