/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { AuthProvider } from '@template/db/generated/client/client';
import type { EncryptedModelConfig } from '@template/db/lib/encryption/types';
import { upperFirst } from 'lodash-es';

export const ENCRYPTED_MODELS = {
  authProvider: {
    model: 'authProvider',
    keys: {
      secrets: {
        envPrefix: 'AUTH_PROVIDER_SECRETS',
        buildAAD: (r: Pick<AuthProvider, 'id' | 'organizationId'>) => `authProvider:${r.id}:${r.organizationId}`,
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

// Derives `{ ModelName: [encryptedField, metadataField, versionField, ...] }`
// from ENCRYPTED_MODELS so downstream registries (ignoreFields, redactFields)
// don't need to re-list the same column triplets. Keys are Prisma model names
// (PascalCase) to match the registry consumers' lookup convention.
export const getEncryptedFieldsByModel = (): Record<string, string[]> => {
  const result: Record<string, string[]> = {};
  for (const [accessorName, modelConfig] of Object.entries(ENCRYPTED_MODELS)) {
    const modelName = upperFirst(accessorName);
    const fields: string[] = [];
    for (const keyName of Object.keys(modelConfig.keys)) {
      const { encryptedField, metadataField, versionField } = getFieldNames(keyName);
      fields.push(encryptedField, metadataField, versionField);
    }
    result[modelName] = fields;
  }
  return result;
};
