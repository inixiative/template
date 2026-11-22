/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import { attributeColumnForValueType } from '@template/shared/attributes/parsing/attributeColumnForValueType';
import { parseAttributeValueOrThrow } from '@template/shared/attributes/parsing/parseAttributeValue';
import {
  type AttributeEncodedColumns,
  EMPTY_ATTRIBUTE_COLUMNS,
} from '@template/shared/attributes/typing/columns';
import type { AttributeValueType } from '@template/shared/attributes/typing/valueTypes';

/** Encodes a runtime value into the 5 typed Attribute columns, clearing sibling columns to null. */
export const encodeAttributeValue = (
  valueType: AttributeValueType,
  value: unknown,
): AttributeEncodedColumns => {
  const parsed = parseAttributeValueOrThrow(valueType, value);
  const column = attributeColumnForValueType(valueType);
  return { ...EMPTY_ATTRIBUTE_COLUMNS, [column]: parsed };
};
