/**
 * @atlas
 * @kind type
 * @partOf primitive:shared
 * @uses none
 */
import type { Condition } from '@inixiative/json-rules';
import type { AttributeValueType } from '@template/shared/attributes/typing/valueTypes';

export type AttributeOption = { readonly value: string | number; readonly label: string };

export type AttributeValueRules = {
  readonly options?: readonly AttributeOption[];
  readonly conditions?: Condition;
};

export type AttributeFieldDefinition<TKey extends string = string> = AttributeValueRules & {
  readonly key: TKey;
  readonly valueType: AttributeValueType;
  readonly defaultValue?: unknown;
  readonly label: string;
  readonly description: string;
};

export const defineAttributeField = <const T extends AttributeFieldDefinition>(definition: T): T =>
  definition;
