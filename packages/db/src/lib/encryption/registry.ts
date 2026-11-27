/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { AuthProvider, Jwks, TwoFactor } from '@template/db/generated/client/client';
import type { EncryptedModelConfig } from '@template/db/lib/encryption/types';
import { mapKeys, mapValues, upperFirst } from 'lodash-es';

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
  jwks: {
    model: 'jwks',
    keys: {
      privateKey: {
        envPrefix: 'JWKS_PRIVATE_KEY',
        buildAAD: (r: Pick<Jwks, 'id'>) => `jwks:${r.id}`,
      },
    },
  } satisfies EncryptedModelConfig<'jwks'>,
  twoFactor: {
    model: 'twoFactor',
    keys: {
      totpSecret: {
        envPrefix: 'TWO_FACTOR_SECRET',
        buildAAD: (r: Pick<TwoFactor, 'id' | 'userId'>) => `twoFactor:${r.id}:${r.userId}`,
      },
    },
  } satisfies EncryptedModelConfig<'twoFactor'>,
} as const;

// Helper to derive field names from key name
export const encryptedColumnNamesForKey = (keyName: string) => {
  const pascal = upperFirst(keyName);
  return {
    encryptedField: `encrypted${pascal}`,
    metadataField: `encrypted${pascal}Metadata`,
    versionField: `encrypted${pascal}KeyVersion`,
  };
};

// Derives `{ ModelName: [encryptedField, metadataField, versionField, ...] }`
// from ENCRYPTED_MODELS so downstream registries (noopFields, sensitiveFields)
// don't need to re-list the same column triplets. Keys are Prisma model names
// (PascalCase) to match the registry consumers' lookup convention.
export const encryptedFieldsByModel = (): Record<string, string[]> =>
  mapValues(
    mapKeys(ENCRYPTED_MODELS, (_config, accessorName) => upperFirst(accessorName)),
    (modelConfig) =>
      Object.keys(modelConfig.keys).flatMap((keyName) => {
        const { encryptedField, metadataField, versionField } = encryptedColumnNamesForKey(keyName);
        return [encryptedField, metadataField, versionField];
      }),
  );
