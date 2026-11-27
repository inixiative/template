/**
 * @atlas
 * @kind utils
 * @partOf feature:email
 * @uses primitive:shared
 */
import { readTokenValue } from '@template/email/render/evaluateTemplate/readTokenValue';
import type {
  RuleErrorSink,
  Scope,
  TemplateEvaluationOptions,
} from '@template/email/render/evaluateTemplate/types';
import { escape as escapeHtml, isNil } from 'lodash-es';

const valueProblem = (value: unknown): string | undefined => {
  if (isNil(value) || typeof value === 'function') return 'resolved to nothing';
  if (typeof value === 'object') return 'resolved to a non-primitive value';
  return undefined;
};

export const substituteToken = (
  root: string,
  segments: string,
  scope: Scope,
  onError?: RuleErrorSink,
  options?: TemplateEvaluationOptions,
): string => {
  const token = `${root}${segments}`;
  const read = readTokenValue(root, segments.slice(1), scope, options);
  const detail = 'problem' in read ? read.problem : valueProblem(read.value);
  if (detail === undefined && 'value' in read) return escapeHtml(String(read.value));
  onError?.({ kind: 'token', path: token, detail: `{{${token}}} ${detail}` });
  return '';
};
