/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { toProtocolColumns } from '@template/db/lib/attributes/parsing/toProtocolColumns';
import {
  type AttributeValueType,
  decodeAttributeColumnValue,
  populatedAttributeColumns,
} from '@template/shared/attributes';

/**
 * Unpacks the populated value from a 5-column attribute row. If `valueType` is omitted, infers the
 * active column from whichever of the 5 typed columns is non-null.
 */
export const unpackAttributeValue = (
  row: Record<string, unknown>,
  valueType?: AttributeValueType,
): unknown => {
  const columns = toProtocolColumns(row);
  if (valueType) return decodeAttributeColumnValue(valueType, columns);
  const populated = populatedAttributeColumns(columns);
  if (populated.length === 0) return null;
  switch (populated[0]) {
    case 'valueBoolean':
      return decodeAttributeColumnValue('boolean', columns);
    case 'valueText':
      return decodeAttributeColumnValue('text', columns);
    case 'valueNumber':
      return decodeAttributeColumnValue('number', columns);
    case 'valueDate':
      return decodeAttributeColumnValue('date', columns);
    case 'valueJson':
      return columns.valueJson ?? null;
  }
};
