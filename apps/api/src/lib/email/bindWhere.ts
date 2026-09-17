/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import { type Condition, requiredBindings, resolveBindings } from '@inixiative/json-rules';
import { bindValues } from '#/lib/email/bindValues';

export const bindWhere = (where: Condition, values: Record<string, unknown>): Condition =>
  resolveBindings(where, bindValues(requiredBindings(where), values));
