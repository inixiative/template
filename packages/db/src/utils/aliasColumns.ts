import { getRuntimeDataModel } from '@template/db/utils/runtimeDataModel';
import { modelNames, type ModelName } from '@template/db/utils/modelNames';

/**
 * Generates aliased column expressions for raw SQL queries.
 *
 * Useful when JOINing tables to avoid column name conflicts and
 * to map results back to typed model objects.
 *
 * @example
 * const sql = `
 *   SELECT ${aliasColumns('User')}, ${aliasColumns('Organization', 'org')}
 *   FROM "User"
 *   JOIN "Organization" org ON org.id = "User"."organizationId"
 * `;
 * // Produces: User.id AS "User.id", User.email AS "User.email", org.id AS "org.id", ...
 */
export const aliasColumns = (model: ModelName, alias?: string, fields?: string[]): string => {
  const dataModel = getRuntimeDataModel();
  const modelData = dataModel.models[model];

  if (!modelData) {
    throw new Error(`Model "${model}" not found. Available: ${modelNames.join(', ')}`);
  }

  const prefix = alias || model;

  const columns = modelData.fields
    .filter((field) => {
      // Only include scalar and enum fields (not relations)
      if (field.kind !== 'scalar' && field.kind !== 'enum') return false;
      // If specific fields requested, filter to those
      if (fields?.length && !fields.includes(field.name)) return false;
      return true;
    })
    .map((field) => {
      // Use the field name for both DB column and alias
      // (Prisma schema uses @map for custom DB names, but field.name is the Prisma name)
      return `${prefix}."${field.name}" AS "${prefix}.${field.name}"`;
    });

  if (columns.length === 0) {
    throw new Error(
      `No matching columns found for model "${model}"${fields ? ` with fields: ${fields.join(', ')}` : ''}`,
    );
  }

  return columns.join(', ');
};
