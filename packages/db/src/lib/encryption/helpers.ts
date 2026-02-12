import type { EncryptionKeyring } from '@template/db/lib/encryption/types';
import { EncryptionService } from '@template/db/lib/encryption/encryptionService';
import { ENCRYPTED_MODELS, getFieldNames } from '@template/db/lib/encryption/registry';

type ModelName = keyof typeof ENCRYPTED_MODELS;
type KeyName<M extends ModelName> = keyof (typeof ENCRYPTED_MODELS)[M]['keys'] & string;

type EncryptedFieldPayload<K extends string> = {
  [P in `encrypted${Capitalize<K>}`]: string;
} & {
  [P in `encrypted${Capitalize<K>}Metadata`]: { iv: string; authTag: string };
} & {
  [P in `encrypted${Capitalize<K>}KeyVersion`]: number;
};

const getKeyringFromEnv = (envPrefix: string): EncryptionKeyring => {
  const currentVersion = parseInt(process.env[`${envPrefix}_ENCRYPTION_VERSION`]!, 10);
  if (Number.isNaN(currentVersion)) {
    throw new Error(`Invalid ${envPrefix}_ENCRYPTION_VERSION: must be a valid integer`);
  }

  const previousKey = process.env[`${envPrefix}_ENCRYPTION_KEY_PREVIOUS`];

  return {
    currentVersion,
    currentKey: process.env[`${envPrefix}_ENCRYPTION_KEY_CURRENT`]!,
    previousVersion: previousKey ? currentVersion - 1 : undefined,
    previousKey,
  };
};

export const encryptField = async <
  M extends ModelName,
  K extends KeyName<M>,
>(
  modelName: M,
  keyName: K,
  record: Record<K, unknown> & Record<string, unknown>,
): Promise<EncryptedFieldPayload<K>> => {
  const modelConfig = ENCRYPTED_MODELS[modelName];
  const keyConfig = modelConfig.keys[keyName as keyof typeof modelConfig.keys];
  const fields = getFieldNames(String(keyName));

  const data = record[keyName];
  const keyring = getKeyringFromEnv(keyConfig.envPrefix);
  const service = new EncryptionService(keyring);
  const aad = keyConfig.buildAAD(record as unknown as Parameters<typeof keyConfig.buildAAD>[0]);

  const encrypted = await service.encrypt(data, aad);

  return {
    [fields.encryptedField]: encrypted.ciphertext,
    [fields.metadataField]: { iv: encrypted.iv, authTag: encrypted.authTag },
    [fields.versionField]: encrypted.version,
  } as EncryptedFieldPayload<K>;
};

export const decryptField = async <
  M extends ModelName,
  K extends KeyName<M>,
>(
  modelName: M,
  keyName: K,
  record: EncryptedFieldPayload<K> & Record<string, unknown>,
): Promise<unknown> => {
  const modelConfig = ENCRYPTED_MODELS[modelName];
  const keyConfig = modelConfig.keys[keyName as keyof typeof modelConfig.keys];
  const fields = getFieldNames(String(keyName));

  const keyring = getKeyringFromEnv(keyConfig.envPrefix);
  const service = new EncryptionService(keyring);
  const aad = keyConfig.buildAAD(record as unknown as Parameters<typeof keyConfig.buildAAD>[0]);

  const ciphertext = record[fields.encryptedField] as string;
  const version = record[fields.versionField] as number;
  const metadata = record[fields.metadataField] as { iv: string; authTag: string };

  return service.decrypt({
    ciphertext,
    version,
    iv: metadata.iv,
    authTag: metadata.authTag,
  }, aad);
};

export type DecryptFieldInput<
  M extends keyof typeof ENCRYPTED_MODELS,
  K extends keyof (typeof ENCRYPTED_MODELS)[M]['keys'] & string,
> = Parameters<typeof decryptField<M, K>>[2];
