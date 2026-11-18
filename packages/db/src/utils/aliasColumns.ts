/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 */
import { columnName, hasColumn, type ModelEntry, modelOf } from '@inixiative/field-map';
import { prismaMap } from '@template/db/generated/prismaMap';
import { type ModelName, modelNames } from '@template/db/utils/modelNames';

export const aliasColumns = (model: ModelName, alias?: string, fields?: string[]): string => {
  const modelData = modelOf(prismaMap, model);

  if (!modelData) {
    throw new Error(`Model "${model}" not found. Available: ${modelNames.join(', ')}`);
  }

  const prefix = alias || model;

  // Columns only (scalar and enum fields), as requested; the column is the `@map` name, the alias
  // the Prisma name.
  const columns = Object.entries(modelData.fields as ModelEntry['fields'])
    .filter(([name, field]) => hasColumn(field) && (!fields?.length || fields.includes(name)))
    .map(([name, field]) =>
      hasColumn(field) ? `${prefix}."${columnName(field, name)}" AS "${prefix}.${name}"` : '',
    );

  if (columns.length === 0) {
    throw new Error(
      `No matching columns found for model "${model}"${fields ? ` with fields: ${fields.join(', ')}` : ''}`,
    );
  }

  return columns.join(', ');
};
