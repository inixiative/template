/**
 * @atlas
 * @kind constant
 * @partOf primitive:shared
 * @uses none
 */
import { type Condition, Operator } from '@inixiative/json-rules';

export const deleted: Condition = { field: 'deletedAt', operator: Operator.exists };
export const notDeleted: Condition = { field: 'deletedAt', operator: Operator.notExists };
