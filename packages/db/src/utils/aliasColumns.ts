/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 */
import { prismaMap } from '@template/db/generated/prismaMap';
import { type ModelName, modelNames } from '@template/db/utils/modelNames';

export const aliasColumns = (model: ModelName, alias?: string, fields?: string[]): string => {
  const modelData = prismaMap.models[model];

  if (!modelData) {
    throw new Error(`Model "${model}" not found. Available: ${modelNames.join(', ')}`);
  }

  const prefix = alias || model;

  const columns = Object.entries(modelData.fields as Record<string, { kind: string }>)
    .filter(([name, field]) => {
      // Only include scalar and enum fields (not relations)
      if (field.kind !== 'scalar' && field.kind !== 'enum') return false;
      // If specific fields requested, filter to those
      if (fields?.length && !fields.includes(name)) return false;
      return true;
    })
    .map(([name]) => {
      // Use the field name for both DB column and alias
      // (Prisma schema uses @map for custom DB names, but the field name is the Prisma name)
      return `${prefix}."${name}" AS "${prefix}.${name}"`;
    });

  if (columns.length === 0) {
    throw new Error(
      `No matching columns found for model "${model}"${fields ? ` with fields: ${fields.join(', ')}` : ''}`,
    );
  }

  return columns.join(', ');
};
