/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import { RESERVED_SCOPE_ROOTS } from '@template/email/render/conditionParser';
import { hasUnsafeSegment } from '@template/email/render/settle/hasUnsafeSegment';
import type { RuleErrorSink, Scope } from '@template/email/render/settle/types';
import { escape as escapeHtml, get, isNil } from 'lodash-es';

export const substituteToken = (
  match: string,
  root: string,
  segments: string,
  scope: Scope,
  onError?: RuleErrorSink,
): string => {
  const path = segments.slice(1);
  if (path && hasUnsafeSegment(path)) return match;

  if (RESERVED_SCOPE_ROOTS.has(root)) {
    if (!path) return match;
    const value = get(scope[root], path);
    if (isNil(value) || typeof value === 'function') return match;
    return escapeHtml(String(value));
  }

  if (!Object.hasOwn(scope, root)) return match;
  const value = path ? get(scope[root], path) : scope[root];
  if (isNil(value) || typeof value === 'function') return match;
  if (typeof value === 'object') {
    onError?.(`{{${root}${segments}}} resolved to a non-primitive value and was left unsubstituted`);
    return match;
  }
  return escapeHtml(String(value));
};
