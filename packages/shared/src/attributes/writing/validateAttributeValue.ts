/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import { deduplicateMultiSelect } from '@template/shared/attributes/parsing/deduplicateMultiSelect';
import { isStringArray } from '@template/shared/attributes/parsing/isStringArray';
import { parseAttributeDate } from '@template/shared/attributes/parsing/parseAttributeDate';
import { parseAttributeValue } from '@template/shared/attributes/parsing/parseAttributeValue';
import { AttributeValidationError } from '@template/shared/attributes/typing/columns';
import type { AttributeValueType } from '@template/shared/attributes/typing/valueTypes';
import type { z } from 'zod';

const parseDateWithSchema = <T>(
  raw: unknown,
  dateValue: Date,
  schema: z.ZodType<T>,
): z.ZodSafeParseResult<T> => {
  const [primary, fallback] =
    typeof raw === 'string' ? [raw, dateValue] : [dateValue, dateValue.toISOString()];
  const first = schema.safeParse(primary);
  if (first.success) return first;
  const second = schema.safeParse(fallback);
  return second.success ? second : first;
};

/**
 * Validates a single runtime attribute value against `valueType` and optional Zod `schema`,
 * canonicalizing `multiSelect` arrays and `date` values. Throws `AttributeValidationError` on failure.
 */
export const validateAttributeValue = <T = unknown>(
  valueType: AttributeValueType,
  raw: unknown,
  schema?: z.ZodType<T>,
  options?: { context?: string; pathPrefix?: string[] },
): T => {
  const pathPrefix = options?.pathPrefix ?? [];
  const parsedValue = parseAttributeValue(
    valueType,
    raw,
    options?.context,
    pathPrefix.length ? pathPrefix : undefined,
  );
  if (!schema) return parsedValue as T;

  const checked =
    valueType === 'date'
      ? parseDateWithSchema(raw, parsedValue as Date, schema)
      : schema.safeParse(parsedValue);

  if (!checked.success) {
    throw new AttributeValidationError(
      checked.error.issues.map((zodIssue) => ({
        code: 'schema_validation_failed',
        message: options?.context ? `${options.context}: ${zodIssue.message}` : zodIssue.message,
        path: [...pathPrefix, ...zodIssue.path.map(String)],
      })),
    );
  }

  if (valueType === 'multiSelect' && isStringArray(checked.data)) {
    return deduplicateMultiSelect(checked.data) as T;
  }
  if (valueType === 'date') {
    return (parseAttributeDate(checked.data) ?? parsedValue) as T;
  }
  return checked.data;
};
