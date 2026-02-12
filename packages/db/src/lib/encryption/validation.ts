import { ENCRYPTED_MODELS, getFieldNames } from '@template/db/lib/encryption/registry';
import type { Db } from '@template/db/clientTypes';
import type { RuntimeDelegate } from '@template/db/utils/delegates';

export const validateEncryptionVersions = async (db: Db) => {
  const errors: string[] = [];

  for (const [modelName, modelConfig] of Object.entries(ENCRYPTED_MODELS)) {
    for (const [keyName, keyConfig] of Object.entries(modelConfig.keys)) {
      const fields = getFieldNames(keyName);
      const versionStr = process.env[`${keyConfig.envPrefix}_ENCRYPTION_VERSION`];
      const currentKey = process.env[`${keyConfig.envPrefix}_ENCRYPTION_KEY_CURRENT`];
      const previousKey = process.env[`${keyConfig.envPrefix}_ENCRYPTION_KEY_PREVIOUS`];

      if (!versionStr || !currentKey) {
        errors.push(`${modelName}.${fields.encryptedField}: Missing required env vars`);
        continue;
      }

      const currentVersion = parseInt(versionStr, 10);
      if (isNaN(currentVersion)) {
        errors.push(`${modelName}.${fields.encryptedField}: Invalid version number: ${versionStr}`);
        continue;
      }

      // Validate env vars (keys validated by Zod, but check version requirement)
      if (currentVersion > 1 && !previousKey) {
        errors.push(
          `${modelName}.${fields.encryptedField}: Previous key required when version > 1 (current: ${currentVersion})`,
        );
      }

      // Validate keys are different (prevent accidental same-key rotation)
      if (previousKey && currentKey === previousKey) {
        errors.push(
          `${modelName}.${fields.encryptedField}: Current and previous keys must be different`,
        );
      }

      const distinctVersions = await (db[modelConfig.model] as unknown as RuntimeDelegate).findMany({
        distinct: [fields.versionField],
        select: { [fields.versionField]: true },
      });

      const versions = distinctVersions
        .map((r) => r[fields.versionField] as number)
        .filter(Boolean)
        .sort((a, b) => a - b);

      if (versions.length === 0) continue;

      const maxDbVersion = Math.max(...versions);

      if (currentVersion < maxDbVersion) {
        errors.push(
          `${modelName}.${fields.encryptedField}: Version downgrade detected! ` +
            `Env version ${currentVersion} < DB max version ${maxDbVersion}`,
        );
      }

      if (currentVersion > maxDbVersion + 1) {
        errors.push(
          `${modelName}.${fields.encryptedField}: Version jump too large! ` +
            `Env version ${currentVersion} but DB max version ${maxDbVersion} ` +
            `(can only increment by 1)`,
        );
      }

      if (currentVersion > maxDbVersion && versions.length > 1) {
        errors.push(
          `${modelName}.${fields.encryptedField}: Cannot bump version! ` +
            `Found ${versions.length} versions in DB: ${versions.join(', ')}. ` +
            `All records must be on version ${maxDbVersion} before bumping to ${currentVersion}`,
        );
      }

      if (versions.length > 2) {
        errors.push(
          `${modelName}.${fields.encryptedField}: Too many versions! ` +
            `Found ${versions.length} versions: ${versions.join(', ')}. Max 2 allowed.`,
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
