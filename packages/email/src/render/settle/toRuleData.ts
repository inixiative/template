/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import type { Scope } from '@template/email/render/settle/types';

export const toRuleData = (scope: Scope): Record<string, unknown> =>
  Object.fromEntries(Object.entries(scope).filter(([, value]) => value !== undefined));
