/**
 * @atlas
 * @kind constant
 * @partOf primitive:authz
 * @uses none
 */
import { type Condition, Operator } from '@inixiative/json-rules';

export const fieldIs = (field: string, value: string): Condition => ({
  field,
  operator: Operator.equals,
  value,
});

export const creating: Condition = { field: 'id', operator: Operator.notExists };
export const updating: Condition = { field: 'id', operator: Operator.exists };
export const deleted: Condition = { field: 'deletedAt', operator: Operator.exists };
export const notDeleted: Condition = { field: 'deletedAt', operator: Operator.notExists };
