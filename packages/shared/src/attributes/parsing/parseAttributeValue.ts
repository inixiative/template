/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import { deduplicateMultiSelect } from '@template/shared/attributes/parsing/deduplicateMultiSelect';
import { isStringArray } from '@template/shared/attributes/parsing/isStringArray';
import { parseAttributeDate } from '@template/shared/attributes/parsing/parseAttributeDate';
import type { AttributeValueType } from '@template/shared/attributes/typing/valueTypes';

export type ParsedAttributeValue = { ok: true; value: unknown } | { ok: false; message: string };

/**
 * Canonical value parser for all 6 AttributeValueTypes.
 * Single source of truth reused by `encodeAttributeValue`, `attributeTypedColumnIssues`,
 * and DB attribute query operators (`attributeWhereEquals`, `attributeWhereIn`, `attributeWhereRange`).
 */
export const parseAttributeValue = (
  valueType: AttributeValueType,
  raw: unknown,
): ParsedAttributeValue => {
  switch (valueType) {
    case 'boolean':
      return typeof raw === 'boolean'
        ? { ok: true, value: raw }
        : { ok: false, message: `Expected boolean value for attribute valueType 'boolean'` };
    case 'text':
      return typeof raw === 'string'
        ? { ok: true, value: raw }
        : { ok: false, message: `Expected string value for attribute valueType 'text'` };
    case 'number':
      return typeof raw === 'number' && Number.isFinite(raw)
        ? { ok: true, value: raw }
        : { ok: false, message: `Expected finite number for attribute valueType 'number'` };
    case 'date': {
      const parsed = parseAttributeDate(raw);
      return parsed
        ? { ok: true, value: parsed }
        : {
            ok: false,
            message: `Expected valid Date or ISO date string for attribute valueType 'date'`,
          };
    }
    case 'json':
      return raw !== undefined && raw !== null
        ? { ok: true, value: raw }
        : { ok: false, message: `Expected non-null JSON value for attribute valueType 'json'` };
    case 'multiSelect':
      return isStringArray(raw)
        ? { ok: true, value: deduplicateMultiSelect(raw) }
        : { ok: false, message: `Expected string[] for attribute valueType 'multiSelect'` };
  }
};

/** Parses `raw` for `valueType`, throwing an Error with optional `context` prefix on invalid input. */
export const parseAttributeValueOrThrow = (
  valueType: AttributeValueType,
  raw: unknown,
  context?: string,
): unknown => {
  const parsed = parseAttributeValue(valueType, raw);
  if (!parsed.ok) {
    throw new Error(context ? `${context}: ${parsed.message}` : parsed.message);
  }
  return parsed.value;
};
