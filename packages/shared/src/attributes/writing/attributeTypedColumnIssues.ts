/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import { attributeColumnForValueType } from '@template/shared/attributes/parsing/attributeColumnForValueType';
import { deduplicateMultiSelect } from '@template/shared/attributes/parsing/deduplicateMultiSelect';
import { isStringArray } from '@template/shared/attributes/parsing/isStringArray';
import { parseAttributeDate } from '@template/shared/attributes/parsing/parseAttributeDate';
import { parseAttributeValue } from '@template/shared/attributes/parsing/parseAttributeValue';
import {
  ATTRIBUTE_COLUMN_NAMES,
  type AttributeTypedColumns,
  type AttributeValidationIssue,
  type AttributeValidationResult,
} from '@template/shared/attributes/typing/columns';
import type { AttributeValueType } from '@template/shared/attributes/typing/valueTypes';
import { encodeAttributeValue } from '@template/shared/attributes/writing/encodeAttributeValue';
import type { z } from 'zod';

/**
 * Checks that a typed-column row has ONLY the column matching `valueType` populated,
 * parses the runtime value via `parseAttributeValue`, and (when provided) satisfies `schema`.
 * Returns every issue found without throwing.
 */
export const attributeTypedColumnIssues = <T = unknown>(
  valueType: AttributeValueType,
  row: Partial<AttributeTypedColumns>,
  schema?: z.ZodType<T>,
): AttributeValidationResult<T> => {
  const issues: AttributeValidationIssue[] = [];
  const targetColumn = attributeColumnForValueType(valueType);

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
    return { ok: false, issues };
  }

  const parsedValue = parseAttributeValue(valueType, rawValue);
  if (!parsedValue.ok) {
    issues.push({
      code: 'invalid_attribute_type',
      message: `Column '${targetColumn}': ${parsedValue.message}`,
      path: [targetColumn],
    });
  }

  if (issues.length > 0 || !parsedValue.ok) return { ok: false, issues };

  let finalValue: unknown = parsedValue.value;
  if (schema) {
    let parsed: z.ZodSafeParseResult<T>;
    if (valueType === 'date') {
      const dateValue = parsedValue.value as Date;
      if (typeof rawValue === 'string') {
        const stringAttempt = schema.safeParse(rawValue);
        parsed = stringAttempt.success ? stringAttempt : schema.safeParse(dateValue);
        if (!parsed.success) parsed = stringAttempt;
      } else {
        const dateAttempt = schema.safeParse(dateValue);
        parsed = dateAttempt.success ? dateAttempt : schema.safeParse(dateValue.toISOString());
        if (!parsed.success) parsed = dateAttempt;
      }
    } else {
      parsed = schema.safeParse(parsedValue.value);
    }

    if (!parsed.success) {
      for (const zodIssue of parsed.error.issues) {
        issues.push({
          code: 'schema_validation_failed',
          message: zodIssue.message,
          path: [targetColumn, ...zodIssue.path.map(String)],
        });
      }
      return { ok: false, issues };
    }

    if (valueType === 'multiSelect' && isStringArray(parsed.data)) {
      finalValue = deduplicateMultiSelect(parsed.data);
    } else if (valueType === 'date') {
      finalValue = parseAttributeDate(parsed.data) ?? parsedValue.value;
    } else {
      finalValue = parsed.data;
    }
  }

  return {
    ok: true,
    value: finalValue as T,
    columns: encodeAttributeValue(valueType, finalValue),
  };
};
