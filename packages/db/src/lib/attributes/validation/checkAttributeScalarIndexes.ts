/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { AttributeModelConfig } from '@template/db/lib/attributes/types';
import type { ModelName } from '@template/db/utils/modelNames';
import type { AttributeColumnName } from '@template/shared/attributes';

const SCALAR_INDEXED_COLUMNS: readonly AttributeColumnName[] = [
  'valueBoolean',
  'valueText',
  'valueNumber',
  'valueDate',
];

const isLeadingScalarIndex = (
  fields: readonly string[],
  columnName: AttributeColumnName,
  locatorField?: string,
): boolean =>
  fields[0] === columnName ||
  Boolean(locatorField && fields[0] === locatorField && fields[1] === columnName);

/** Verifies each of the 4 scalar attribute columns has a leading index (`[col]` or `[locatorField, col]`). */
export const checkAttributeScalarIndexes = (
  modelName: ModelName,
  config: AttributeModelConfig,
  indexLists: readonly (readonly string[])[],
): string[] => {
  const errors: string[] = [];
  for (const columnName of SCALAR_INDEXED_COLUMNS) {
    const hasScalarIndex = indexLists.some((fields) =>
      isLeadingScalarIndex(fields, columnName, config.locatorField),
    );
    if (!hasScalarIndex) {
      const suggested = config.locatorField
        ? `@@index([${config.locatorField}, ${columnName}])`
        : `@@index([${columnName}])`;
      errors.push(`${modelName}.${columnName}: missing scalar value index (add ${suggested})`);
    }
  }
  return errors;
};
