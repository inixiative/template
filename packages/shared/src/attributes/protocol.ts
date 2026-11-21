/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import {
  ATTRIBUTE_COLUMN_NAMES,
  type AttributeColumnName,
  type AttributeEncodedColumns,
  type AttributeTypedColumns,
  type AttributeValidationIssue,
  type AttributeValidationResult,
  type AttributeValueType,
} from '@template/shared/attributes/types';
import type { z } from 'zod';

const COLUMN_BY_VALUE_TYPE: Record<AttributeValueType, AttributeColumnName> = {
  boolean: 'valueBoolean',
  text: 'valueText',
  number: 'valueNumber',
  date: 'valueDate',
  json: 'valueJson',
  multiSelect: 'valueJson',
};

export const EMPTY_ATTRIBUTE_COLUMNS: AttributeEncodedColumns = {
  valueBoolean: null,
  valueText: null,
  valueNumber: null,
  valueDate: null,
  valueJson: null,
};

/** The physical typed column holding values of `valueType`. */
export const attributeColumnForValueType = (valueType: AttributeValueType): AttributeColumnName =>
  COLUMN_BY_VALUE_TYPE[valueType];

/** Deduplicates and canonically sorts a multi-select string array for set-equality stability. */
export const deduplicateMultiSelect = (values: readonly string[]): string[] =>
  [...new Set(values)].sort();

/** Type guard for string[] (single source of truth across shared and db attribute layers). */
export const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

/** Parses a Date or ISO-8601 date string into a valid Date, or returns null if invalid. */
export const parseAttributeDate = (raw: unknown): Date | null => {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

/** Encodes a runtime value into the 5 typed Attribute columns, clearing sibling columns to null. */
export const encodeAttributeValue = (
  valueType: AttributeValueType,
  value: unknown,
): AttributeEncodedColumns => {
  switch (valueType) {
    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new Error(
          `Expected boolean value for attribute valueType 'boolean', got ${typeof value}`,
        );
      }
      return { ...EMPTY_ATTRIBUTE_COLUMNS, valueBoolean: value };
    case 'text':
      if (typeof value !== 'string') {
        throw new Error(
          `Expected string value for attribute valueType 'text', got ${typeof value}`,
        );
      }
      return { ...EMPTY_ATTRIBUTE_COLUMNS, valueText: value };
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(
          `Expected finite number for attribute valueType 'number', got ${String(value)}`,
        );
      }
      return { ...EMPTY_ATTRIBUTE_COLUMNS, valueNumber: value };
    case 'date': {
      const parsed = parseAttributeDate(value);
      if (!parsed) {
        throw new Error(
          `Expected valid Date or ISO date string for attribute valueType 'date', got ${String(value)}`,
        );
      }
      return { ...EMPTY_ATTRIBUTE_COLUMNS, valueDate: parsed };
    }
    case 'json':
      if (value === undefined || value === null) {
        throw new Error(`Expected non-null JSON value for attribute valueType 'json'`);
      }
      return { ...EMPTY_ATTRIBUTE_COLUMNS, valueJson: value };
    case 'multiSelect':
      if (!isStringArray(value)) {
        throw new Error(`Expected string[] for attribute valueType 'multiSelect'`);
      }
      return { ...EMPTY_ATTRIBUTE_COLUMNS, valueJson: deduplicateMultiSelect(value) };
  }
};

/** Decodes the active typed column for `valueType` back into its runtime JS value (or null when unset). */
export const decodeAttributeColumnValue = (
  valueType: AttributeValueType,
  row: Partial<AttributeTypedColumns>,
): unknown => {
  switch (valueType) {
    case 'boolean':
      return row.valueBoolean ?? null;
    case 'text':
      return row.valueText ?? null;
    case 'number':
      return typeof row.valueNumber === 'number' && Number.isFinite(row.valueNumber)
        ? row.valueNumber
        : null;
    case 'date':
      return parseAttributeDate(row.valueDate);
    case 'json':
      return row.valueJson ?? null;
    case 'multiSelect':
      return isStringArray(row.valueJson) ? deduplicateMultiSelect(row.valueJson) : null;
  }
};

/** Lists every populated typed column name on a row (non-null and non-undefined). */
export const populatedAttributeColumns = (
  row: Partial<AttributeTypedColumns>,
): AttributeColumnName[] =>
  ATTRIBUTE_COLUMN_NAMES.filter((column) => row[column] !== null && row[column] !== undefined);

/**
 * Checks that a typed-column row has ONLY the column matching `valueType` populated,
 * matches the runtime shape for `valueType`, and (when provided) satisfies `schema`.
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

  let normalizedValue: unknown;
  switch (valueType) {
    case 'boolean':
      if (typeof rawValue !== 'boolean') {
        issues.push({
          code: 'invalid_attribute_type',
          message: `Column '${targetColumn}' must be a boolean`,
          path: [targetColumn],
        });
      } else {
        normalizedValue = rawValue;
      }
      break;
    case 'text':
      if (typeof rawValue !== 'string') {
        issues.push({
          code: 'invalid_attribute_type',
          message: `Column '${targetColumn}' must be a string`,
          path: [targetColumn],
        });
      } else {
        normalizedValue = rawValue;
      }
      break;
    case 'number':
      if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
        issues.push({
          code: 'invalid_attribute_type',
          message: `Column '${targetColumn}' must be a finite number`,
          path: [targetColumn],
        });
      } else {
        normalizedValue = rawValue;
      }
      break;
    case 'date': {
      const parsed = parseAttributeDate(rawValue);
      if (!parsed) {
        issues.push({
          code: 'invalid_attribute_type',
          message: `Column '${targetColumn}' must be a valid Date`,
          path: [targetColumn],
        });
      } else {
        normalizedValue = parsed;
      }
      break;
    }
    case 'json':
      normalizedValue = rawValue;
      break;
    case 'multiSelect':
      if (!isStringArray(rawValue)) {
        issues.push({
          code: 'invalid_attribute_type',
          message: `Column '${targetColumn}' must be a string[] for valueType 'multiSelect'`,
          path: [targetColumn],
        });
      } else {
        normalizedValue = deduplicateMultiSelect(rawValue);
      }
      break;
  }

  if (issues.length > 0) return { ok: false, issues };

  let finalValue: unknown = normalizedValue;
  if (schema) {
    let parsed: z.ZodSafeParseResult<T>;
    if (valueType === 'date') {
      const dateValue = normalizedValue as Date;
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
      parsed = schema.safeParse(normalizedValue);
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
      finalValue = parseAttributeDate(parsed.data) ?? normalizedValue;
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
