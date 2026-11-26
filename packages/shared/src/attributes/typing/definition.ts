/**
 * @atlas
 * @kind type
 * @partOf primitive:shared
 * @uses none
 */
import type { AttributeValueType } from '@template/shared/attributes/typing/valueTypes';
import type { z } from 'zod';

/**
 * Base definition contract shared by both code-defined attribute fields (Settings)
 * and future DB-backed custom-field definitions (where `schema` is optional).
 */
export type AttributeFieldDefinition<TKey extends string = string, TValue = unknown> = {
  readonly key: TKey;
  readonly valueType: AttributeValueType;
  readonly schema?: z.ZodType<TValue>;
  readonly defaultValue?: TValue | null;
  readonly label: string;
  readonly description: string;
};

/** Declares a typed attribute field definition without side effects. */
export const defineAttributeField = <const T extends AttributeFieldDefinition>(definition: T): T =>
  definition;
