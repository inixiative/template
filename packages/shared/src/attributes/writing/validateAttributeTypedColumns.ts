/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import type { AttributeTypedColumns } from '@template/shared/attributes/typing/columns';
import type { AttributeValueType } from '@template/shared/attributes/typing/valueTypes';
import { attributeTypedColumnIssues } from '@template/shared/attributes/writing/attributeTypedColumnIssues';
import type { z } from 'zod';

/** Validates typed columns and throws an Error listing all issues on failure. */
export const validateAttributeTypedColumns = <T = unknown>(
  valueType: AttributeValueType,
  row: Partial<AttributeTypedColumns>,
  schema?: z.ZodType<T>,
): T => {
  const result = attributeTypedColumnIssues(valueType, row, schema);
  if (!result.ok) {
    throw new Error(result.issues.map((issue) => issue.message).join('; '));
  }
  return result.value;
};
