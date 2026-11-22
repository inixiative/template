/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import {
  ATTRIBUTE_COLUMN_NAMES,
  type AttributeColumnName,
  type AttributeTypedColumns,
} from '@template/shared/attributes/typing/columns';

/** Lists every populated typed column name on a row (non-null and non-undefined). */
export const populatedAttributeColumns = (
  row: Partial<AttributeTypedColumns>,
): AttributeColumnName[] =>
  ATTRIBUTE_COLUMN_NAMES.filter((column) => row[column] !== null && row[column] !== undefined);
