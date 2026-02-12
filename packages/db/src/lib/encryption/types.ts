import type { AccessorName, ModelName, ModelNameFromAccessor, ModelTypeMap } from '@template/db/utils/modelNames';

export interface EncryptedFieldData {
  ciphertext: string; // Base64 AES-256-GCM encrypted data
  version: number; // 1, 2, 3, etc. (not "v1", "v2")
  iv: string; // Base64 IV (12 bytes)
  authTag: string; // Base64 auth tag (16 bytes)
}

export interface EncryptionKeyring {
  currentVersion: number; // 2
  currentKey: string; // Base64 32-byte key
  previousVersion?: number; // 1 (derived: currentVersion - 1)
  previousKey?: string; // Base64 32-byte key
}

export type EncryptedFieldConfig<M extends ModelName> = {
  envPrefix: string;
  buildAAD: (row: ModelTypeMap[M]) => string;
};

export type EncryptedModelConfig<A extends AccessorName> = {
  model: A;
  keys: Record<string, EncryptedFieldConfig<ModelNameFromAccessor<A>>>;
};
