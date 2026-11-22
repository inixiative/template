/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import {
  attributeColumnForValueType,
  parseAttributeValueOrThrow,
} from '@template/shared/attributes/parsing';
import {
  type AttributeEncodedColumns,
  type AttributeValueType,
  EMPTY_ATTRIBUTE_COLUMNS,
} from '@template/shared/attributes/typing';

/** Encodes a runtime value into the 5 typed Attribute columns, clearing sibling columns to null. */
export const encodeAttributeValue = (
  valueType: AttributeValueType,
  value: unknown,
): AttributeEncodedColumns => {
  const parsed = parseAttributeValueOrThrow(valueType, value);
  const column = attributeColumnForValueType(valueType);
  return { ...EMPTY_ATTRIBUTE_COLUMNS, [column]: parsed };
};
