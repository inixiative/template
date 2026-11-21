/**
 * @atlas
 * @kind type
 * @partOf primitive:shared
 * @uses none
 */
import { z } from 'zod';

export const ATTRIBUTE_VALUE_TYPES = [
  'boolean',
  'text',
  'number',
  'date',
  'json',
  'multiSelect',
] as const;

export type AttributeValueType = (typeof ATTRIBUTE_VALUE_TYPES)[number];

export const AttributeValueTypeSchema = z.enum(ATTRIBUTE_VALUE_TYPES);

/** Uniform 5-column contract carried by every model registered in ATTRIBUTE_MODELS. */
export const ATTRIBUTE_COLUMN_NAMES = [
  'valueBoolean',
  'valueText',
  'valueNumber',
  'valueDate',
  'valueJson',
] as const;

export type AttributeColumnName = (typeof ATTRIBUTE_COLUMN_NAMES)[number];

/** Typed value columns stored on any Attribute-capable model (e.g. Setting). */
export type AttributeTypedColumns = {
  valueBoolean: boolean | null;
  valueText: string | null;
  valueNumber: number | null;
  valueDate: Date | string | null;
  valueJson: unknown;
};

/** Encoded columns produced for writes: at most one column populated, the other four null. */
export type AttributeEncodedColumns = {
  valueBoolean: boolean | null;
  valueText: string | null;
  valueNumber: number | null;
  valueDate: Date | null;
  valueJson: unknown;
};

export type AttributeValidationIssue = {
  code: string;
  message: string;
  path?: string[];
};

export type AttributeValidationResult<T = unknown> =
  | { ok: true; value: T; columns: AttributeEncodedColumns }
  | { ok: false; issues: AttributeValidationIssue[] };

/** Base definition contract shared by any code-defined attribute field (Settings, etc.). */
export type AttributeFieldDefinition<TKey extends string = string, TValue = unknown> = {
  readonly key: TKey;
  readonly valueType: AttributeValueType;
  readonly schema: z.ZodType<TValue>;
  readonly defaultValue: TValue | null;
  readonly label: string;
  readonly description: string;
  readonly category?: string;
  readonly order?: number;
  readonly resourceModels?: readonly string[];
  readonly permission?: string;
  readonly readPermission?: string;
};

/** Declares a typed attribute field definition without side effects. */
export const defineAttributeField = <const T extends AttributeFieldDefinition>(definition: T): T =>
  definition;
