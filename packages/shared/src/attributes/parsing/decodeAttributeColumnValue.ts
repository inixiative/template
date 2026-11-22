/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import { deduplicateMultiSelect } from '@template/shared/attributes/parsing/deduplicateMultiSelect';
import { isStringArray } from '@template/shared/attributes/parsing/isStringArray';
import { parseAttributeDate } from '@template/shared/attributes/parsing/parseAttributeDate';
import type { AttributeTypedColumns } from '@template/shared/attributes/typing/columns';
import type { AttributeValueType } from '@template/shared/attributes/typing/valueTypes';

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
