/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import type { AttributeColumnName, AttributeValueType } from '@template/shared/attributes/typing';

const COLUMN_BY_VALUE_TYPE: Record<AttributeValueType, AttributeColumnName> = {
  boolean: 'valueBoolean',
  text: 'valueText',
  number: 'valueNumber',
  date: 'valueDate',
  json: 'valueJson',
  multiSelect: 'valueJson',
};

/** The physical typed column holding values of `valueType`. */
export const attributeColumnForValueType = (valueType: AttributeValueType): AttributeColumnName =>
  COLUMN_BY_VALUE_TYPE[valueType];
