/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import { attributeColumnForValueType } from '@template/shared/attributes/parsing/attributeColumnForValueType';
import {
  ATTRIBUTE_COLUMN_NAMES,
  type AttributeTypedColumns,
  AttributeValidationError,
  type AttributeValidationIssue,
} from '@template/shared/attributes/typing/columns';
import type { AttributeValueType } from '@template/shared/attributes/typing/valueTypes';
import { validateAttributeValue } from '@template/shared/attributes/writing/validateAttributeValue';
import type { z } from 'zod';

/**
 * Validates that a typed-column row has ONLY the column matching `valueType` populated,
 * parses the value, and satisfies optional `schema`. Throws `AttributeValidationError` on failure.
 */
export const validateAttributeTypedColumns = <T = unknown>(
  valueType: AttributeValueType,
  row: Partial<AttributeTypedColumns>,
  schema?: z.ZodType<T>,
): T => {
  const targetColumn = attributeColumnForValueType(valueType);
  const issues: AttributeValidationIssue[] = [];

  for (const column of ATTRIBUTE_COLUMN_NAMES) {
    if (column === targetColumn) continue;
    if (row[column] !== null && row[column] !== undefined) {
      issues.push({
        code: 'unexpected_attribute_column',
        message: `Column '${column}' must be null when valueType is '${valueType}' (expected '${targetColumn}')`,
        path: [column],
      });
    }
  }

  const rawValue = row[targetColumn];
  if (rawValue === null || rawValue === undefined) {
    issues.push({
      code: 'missing_attribute_value',
      message: `Column '${targetColumn}' is required when valueType is '${valueType}'`,
      path: [targetColumn],
    });
  }

  if (issues.length > 0) throw new AttributeValidationError(issues);

  return validateAttributeValue(valueType, rawValue, schema, {
    context: `Column '${targetColumn}'`,
    pathPrefix: [targetColumn],
  });
};
