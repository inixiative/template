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

const empty = (path: string, detail: string, onError?: RuleErrorSink): string => {
  onError?.({ kind: 'token', path, detail });
  return '';
};

export const substituteToken = (root: string, segments: string, scope: Scope, onError?: RuleErrorSink): string => {
  const path = segments.slice(1);
  const token = `${root}${segments}`;
  if (path && hasUnsafeSegment(path)) return empty(token, `{{${token}}} addresses a prototype key`, onError);

  if (RESERVED_SCOPE_ROOTS.has(root)) {
    if (!path) return empty(token, `{{${token}}} names a scope root, not a value`, onError);
    const value = get(scope[root], path);
    if (isNil(value) || typeof value === 'function') return empty(token, `{{${token}}} resolved to nothing`, onError);
    if (typeof value === 'object') return empty(token, `{{${token}}} resolved to a non-primitive value`, onError);
    return escapeHtml(String(value));
  }

  if (!Object.hasOwn(scope, root)) return empty(token, `{{${token}}} names no scope root or loop binding`, onError);
  const value = path ? get(scope[root], path) : scope[root];
  if (isNil(value) || typeof value === 'function') return empty(token, `{{${token}}} resolved to nothing`, onError);
  if (typeof value === 'object') return empty(token, `{{${token}}} resolved to a non-primitive value`, onError);
  return escapeHtml(String(value));
};
