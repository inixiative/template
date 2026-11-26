/**
 * @atlas
 * @kind utils
 * @partOf feature:email
 * @uses primitive:shared
 */
import { readLensValue } from '@inixiative/json-rules';
import { RESERVED_SCOPE_ROOTS } from '@template/email/render/conditionParser';
import { hasUnsafeSegment } from '@template/email/render/evaluateTemplate/hasUnsafeSegment';
import type {
  Scope,
  TemplateEvaluationOptions,
} from '@template/email/render/evaluateTemplate/types';
import { OPAQUE_SLOT, slotOf } from '@template/email/rules/emailLens';
import { get } from 'lodash-es';

type TokenValue = { value: unknown } | { problem: string };

const scopeRootValue = (
  root: string,
  path: string,
  scope: Scope,
  options?: TemplateEvaluationOptions,
): { value: unknown } | { refused: string } => {
  const slot = options?.lens && slotOf(options.lens, root);
  if (!slot || slot === OPAQUE_SLOT) return { value: get(scope[root], path) };
  const row = (options.ruleScope ?? scope)[root];
  if (!row || typeof row !== 'object') return { value: undefined };
  const read = readLensValue(slot, row as Record<string, unknown>, path);
  return read.ok ? { value: read.value } : { refused: read.reason };
};

export const readTokenValue = (
  root: string,
  path: string,
  scope: Scope,
  options?: TemplateEvaluationOptions,
): TokenValue => {
  if (path && hasUnsafeSegment(path)) return { problem: 'addresses a prototype key' };

  if (RESERVED_SCOPE_ROOTS.has(root)) {
    if (!path) return { problem: 'names a scope root, not a value' };
    const read = scopeRootValue(root, path, scope, options);
    if ('refused' in read) return { problem: `is not a value the lens shows (${read.refused})` };
    return read;
  }

  if (!Object.hasOwn(scope, root)) return { problem: 'names no scope root or loop binding' };
  return { value: path ? get(scope[root], path) : scope[root] };
};
