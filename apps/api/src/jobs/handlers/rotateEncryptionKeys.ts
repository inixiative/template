import type { RuntimeDelegate } from '@template/db/utils/delegates';
import { ConcurrencyType, getConcurrency, resolveAll } from '@template/shared/utils';
import { ENCRYPTED_MODELS, getFieldNames } from '@template/db/lib/encryption/registry';
import { encryptField, decryptField } from '@template/db/lib/encryption/helpers';
import type { DecryptFieldInput } from '@template/db/lib/encryption/helpers';
import { makeSingletonJob } from '#/jobs/makeSingletonJob';
import type { JobHandler } from '#/jobs/types';

export const rotateEncryptionKeys: JobHandler<void> = makeSingletonJob(async (ctx) => {
  const { db, log } = ctx;

  const rotations = await Promise.all(
    (Object.keys(ENCRYPTED_MODELS) as Array<keyof typeof ENCRYPTED_MODELS>).flatMap((modelName) => {
      const modelConfig = ENCRYPTED_MODELS[modelName];
      const delegate = db[modelConfig.model] as unknown as RuntimeDelegate;

      return (Object.keys(modelConfig.keys) as Array<keyof typeof modelConfig.keys>).map(async (keyName) => {
        const keyConfig = modelConfig.keys[keyName];
        const targetVersion = Number.parseInt(process.env[`${keyConfig.envPrefix}_ENCRYPTION_VERSION`]!, 10);
        const fromVersion = targetVersion - 1;

        const fields = getFieldNames(String(keyName));
        const staleRecords = await delegate.findMany({
          where: { [fields.versionField]: fromVersion },
        });
        if (!staleRecords.length) return [];

        log(`Starting rotation: ${modelName}.${String(keyName)} ${fromVersion} → ${targetVersion}`);
        log(`Found ${staleRecords.length} total records to rotate`);

        return staleRecords.map((record: Record<string, unknown>) => async () => {
          try {
            const decryptRecord = record as DecryptFieldInput<typeof modelName, typeof keyName>;
            const decrypted = await decryptField(
              modelName,
              keyName,
              decryptRecord,
            );
            const recordWithData = { ...record, [keyName]: decrypted };
            const encryptedData = await encryptField(modelName, keyName, recordWithData);

            const updated = await delegate.updateManyAndReturn({
              where: {
                id: record.id,
                [fields.versionField]: fromVersion,
              },
              data: encryptedData as Record<string, unknown>,
            });

            return updated.length > 0;
          } catch (error) {
            log(`Failed to rotate ${modelName} record ${record.id}: ${error instanceof Error ? error.message : String(error)}`);
            return false;
          }
        });
      });
    }),
  );

  const allRotations = rotations.flat();
  const results = await resolveAll(allRotations, getConcurrency([ConcurrencyType.db]));
  const successCount = results.filter(Boolean).length;
  const failedCount = allRotations.length - successCount;

  log(`Rotation complete: ${successCount}/${allRotations.length} records rotated successfully`);

  if (failedCount > 0) {
    throw new Error(
      `Rotation incomplete: ${failedCount}/${allRotations.length} records failed to rotate`,
    );
  }
});
