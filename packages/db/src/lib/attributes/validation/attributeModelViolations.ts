/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { modelOf } from '@inixiative/field-map';
import { prismaMap } from '@template/db/generated/prismaMap';
import { ATTRIBUTE_MODELS } from '@template/db/lib/attributes/registry';
import type { AttributeModelConfig } from '@template/db/lib/attributes/types';
import { checkAttributeColumns } from '@template/db/lib/attributes/validation/checkAttributeColumns';
import { checkAttributeGinIndex } from '@template/db/lib/attributes/validation/checkAttributeGinIndex';
import { checkAttributeScalarIndexes } from '@template/db/lib/attributes/validation/checkAttributeScalarIndexes';
import { toModelName } from '@template/db/utils/modelNames';

const DEFAULT_SCHEMA_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../prisma/schema',
);

export type ValidateAttributeModelsOptions = {
  models?: Record<string, AttributeModelConfig>;
  schemaDir?: string;
  schemaBodyByModel?: Record<string, string>;
  indexesByModel?: Record<string, readonly { fields: readonly string[] }[]>;
};

/**
 * Collects every DMMF & schema-index contract violation across `ATTRIBUTE_MODELS` without throwing.
 * Mirrors `hardDeleteOnTombstoneViolations` for tests and diagnostics.
 */
export const attributeModelViolations = (
  options: ValidateAttributeModelsOptions = {},
): string[] => {
  const models = options.models ?? ATTRIBUTE_MODELS;
  const schemaDir = options.schemaDir ?? DEFAULT_SCHEMA_DIR;
  const errors: string[] = [];

  for (const [accessorName, config] of Object.entries(models)) {
    const modelName = toModelName(config.model);
    const model = modelOf(prismaMap, modelName);

    if (!model) {
      errors.push(`${accessorName}: Prisma model '${modelName}' does not exist in prismaMap`);
      continue;
    }

    errors.push(...checkAttributeColumns(modelName, config));

    const rawIndexes =
      options.indexesByModel?.[modelName] ??
      ('indexes' in model && Array.isArray(model.indexes)
        ? (model.indexes as readonly { fields: readonly string[] }[])
        : []);
    const indexLists = rawIndexes.map((idx) => idx.fields);

    errors.push(...checkAttributeScalarIndexes(modelName, config, indexLists));
    errors.push(
      ...checkAttributeGinIndex(
        modelName,
        indexLists,
        schemaDir,
        options.schemaBodyByModel?.[modelName],
      ),
    );
  }

  return errors;
};
