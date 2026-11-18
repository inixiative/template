/**
 * @atlas
 * @kind utils
 * @partOf feature:email
 * @uses primitive:shared
 */
import type { Scope } from '@template/email/render/evaluateTemplate/types';

export const toRuleData = (scope: Scope): Record<string, unknown> =>
  Object.fromEntries(Object.entries(scope).filter(([, value]) => value !== undefined));
