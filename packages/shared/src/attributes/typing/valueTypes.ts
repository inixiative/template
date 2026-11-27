/**
 * @atlas
 * @kind type
 * @partOf primitive:shared
 * @uses none
 */
import { FieldKind } from '@inixiative/json-rules';

export const ATTRIBUTE_VALUE_TYPES = [
  'boolean',
  'text',
  'number',
  'date',
  'json',
  'multiSelect',
] as const;

export type AttributeValueType = (typeof ATTRIBUTE_VALUE_TYPES)[number];

export const isAttributeValueType = (value: unknown): value is AttributeValueType =>
  typeof value === 'string' && (ATTRIBUTE_VALUE_TYPES as readonly string[]).includes(value);

/** Maps every AttributeValueType to its corresponding `@inixiative/json-rules` FieldKind. */
export const ATTRIBUTE_FIELD_KIND_BY_VALUE_TYPE: Record<AttributeValueType, FieldKind> = {
  boolean: FieldKind.Boolean,
  text: FieldKind.String,
  number: FieldKind.Float,
  date: FieldKind.DateTime,
  json: FieldKind.Json,
  multiSelect: FieldKind.Json,
};
