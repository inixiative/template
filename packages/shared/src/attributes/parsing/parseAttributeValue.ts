/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import { deduplicateMultiSelect } from '@template/shared/attributes/parsing/deduplicateMultiSelect';
import { isStringArray } from '@template/shared/attributes/parsing/isStringArray';
import { parseAttributeDate } from '@template/shared/attributes/parsing/parseAttributeDate';
import { AttributeValidationError } from '@template/shared/attributes/typing/columns';
import type { AttributeValueType } from '@template/shared/attributes/typing/valueTypes';

const invalidTypeError = (message: string, context?: string, path?: string[]) =>
  new AttributeValidationError([
    { code: 'invalid_attribute_type', message: context ? `${context}: ${message}` : message, path },
  ]);

/**
 * Canonical value parser for all 6 AttributeValueTypes. Throws `AttributeValidationError` on
 * invalid input. Reused by `encodeAttributeValue`, `validateAttributeValue`, and DB query operators.
 */
export const parseAttributeValue = (
  valueType: AttributeValueType,
  raw: unknown,
  context?: string,
  path?: string[],
): unknown => {
  switch (valueType) {
    case 'boolean':
      if (typeof raw === 'boolean') return raw;
      throw invalidTypeError(
        `Expected boolean value for attribute valueType 'boolean'`,
        context,
        path,
      );
    case 'text':
      if (typeof raw === 'string') return raw;
      throw invalidTypeError(`Expected string value for attribute valueType 'text'`, context, path);
    case 'number':
      if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
      throw invalidTypeError(
        `Expected finite number for attribute valueType 'number'`,
        context,
        path,
      );
    case 'date': {
      const parsed = parseAttributeDate(raw);
      if (parsed) return parsed;
      throw invalidTypeError(
        `Expected valid Date or ISO date string for attribute valueType 'date'`,
        context,
        path,
      );
    }
    case 'json':
      if (raw !== undefined && raw !== null) return raw;
      throw invalidTypeError(
        `Expected non-null JSON value for attribute valueType 'json'`,
        context,
        path,
      );
    case 'multiSelect':
      if (isStringArray(raw)) return deduplicateMultiSelect(raw);
      throw invalidTypeError(
        `Expected string[] for attribute valueType 'multiSelect'`,
        context,
        path,
      );
  }
};
