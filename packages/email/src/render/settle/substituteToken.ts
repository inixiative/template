/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import { readLensValue } from '@inixiative/json-rules';
import { RESERVED_SCOPE_ROOTS } from '@template/email/render/conditionParser';
import { hasUnsafeSegment } from '@template/email/render/settle/hasUnsafeSegment';
import type { RuleErrorSink, Scope, SettleOptions } from '@template/email/render/settle/types';
import { OPAQUE_SLOT, slotOf } from '@template/email/rules/emailLens';
import { escape as escapeHtml, get, isNil } from 'lodash-es';

const empty = (path: string, detail: string, onError?: RuleErrorSink): string => {
  onError?.({ kind: 'token', path, detail });
  return '';
};

type Read = { value: unknown } | { refused: string };

const readScopeRoot = (root: string, path: string, scope: Scope, options?: SettleOptions): Read => {
  const slot = options?.lens && slotOf(options.lens, root);
  if (!slot || slot === OPAQUE_SLOT) return { value: get(scope[root], path) };
  const row = (options.ruleScope ?? scope)[root];
  if (!row || typeof row !== 'object') return { value: undefined };
  const read = readLensValue(slot, row as Record<string, unknown>, path);
  return read.ok ? { value: read.value } : { refused: read.reason };
};

export const substituteToken = (
  root: string,
  segments: string,
  scope: Scope,
  onError?: RuleErrorSink,
  options?: SettleOptions,
): string => {
  const path = segments.slice(1);
  const token = `${root}${segments}`;
  if (path && hasUnsafeSegment(path))
    return empty(token, `{{${token}}} addresses a prototype key`, onError);

  if (RESERVED_SCOPE_ROOTS.has(root)) {
    if (!path) return empty(token, `{{${token}}} names a scope root, not a value`, onError);
    const read = readScopeRoot(root, path, scope, options);
    if ('refused' in read)
      return empty(token, `{{${token}}} is not a value the lens shows (${read.refused})`, onError);
    const value = read.value;
    if (isNil(value) || typeof value === 'function')
      return empty(token, `{{${token}}} resolved to nothing`, onError);
    if (typeof value === 'object')
      return empty(token, `{{${token}}} resolved to a non-primitive value`, onError);
    return escapeHtml(String(value));
  }

  if (!Object.hasOwn(scope, root))
    return empty(token, `{{${token}}} names no scope root or loop binding`, onError);
  const value = path ? get(scope[root], path) : scope[root];
  if (isNil(value) || typeof value === 'function')
    return empty(token, `{{${token}}} resolved to nothing`, onError);
  if (typeof value === 'object')
    return empty(token, `{{${token}}} resolved to a non-primitive value`, onError);
  return escapeHtml(String(value));
};
