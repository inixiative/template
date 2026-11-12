/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import { bindRule, type Condition, listBindings } from '@inixiative/json-rules';
import { bindValues } from '#/lib/email/bindValues';

export const bindWhere = (where: Condition, values: Record<string, unknown>): Condition =>
  bindRule(where, bindValues(listBindings(where, { required: true }), values));
