/**
 * @atlas
 * @kind utils
 * @partOf feature:email
 * @uses none
 */
import {
  type DateExpr,
  type DateInputValue,
  type DateOffset,
  evaluateValue,
  formatDate,
  type RollingExpr,
} from '@inixiative/json-rules';
import {
  type DatetimeToken,
  datetimeExpressionPaths,
  datetimeTokenLabel,
  datetimeTokenProblems,
} from '@template/email/render/conditionParser';
import { readTokenValue } from '@template/email/render/evaluateTemplate/readTokenValue';
import type {
  RuleErrorSink,
  Scope,
  TemplateEvaluationOptions,
} from '@template/email/render/evaluateTemplate/types';
import { splitRoot } from '@template/email/rules/emailLens';
import { escape as escapeHtml, set } from 'lodash-es';

const collectExpressionScope = (
  token: DatetimeToken,
  scope: Scope,
  options: TemplateEvaluationOptions | undefined,
): { values: Record<string, unknown> } | { problem: string } => {
  const values: Record<string, unknown> = {};
  for (const path of datetimeExpressionPaths(token)) {
    const { root, rest } = splitRoot(path);
    const read = readTokenValue(root, rest, scope, options);
    if ('problem' in read) return { problem: `path "${path}" ${read.problem}` };
    set(values, path, read.value);
  }
  return { values };
};

export const substituteDatetimeToken = (
  token: DatetimeToken,
  scope: Scope,
  onError?: RuleErrorSink,
  options?: TemplateEvaluationOptions,
): string => {
  const label = datetimeTokenLabel(token);
  const issuePath = token.target?.kind === 'path' ? token.target.path : undefined;
  const report = (detail: string): string => {
    onError?.({ kind: 'token', path: issuePath, detail: `${label} ${detail}` });
    return '';
  };

  const problems = datetimeTokenProblems(token);
  if (problems.length > 0) {
    for (const problem of problems) report(problem);
    return '';
  }

  const { target } = token;
  if (!target) return '';

  const timeZone = token.timeZone ?? 'UTC';
  const now = options?.now ?? new Date();
  const evaluationOptions = { now, timeZone };
  const offset = token.offset as RollingExpr | undefined;
  const offsetSource: DateOffset | undefined = offset === undefined ? undefined : { value: offset };

  const collected = collectExpressionScope(token, scope, options);
  if ('problem' in collected) return report(collected.problem);

  let base: Date | string | DateExpr;
  if (target.kind === 'now') {
    base = now;
  } else if (target.kind === 'literal') {
    base = target.value;
  } else if (target.kind === 'expr') {
    base = target.expr as DateExpr;
  } else {
    const { root, rest } = splitRoot(target.path);
    const read = readTokenValue(root, rest, scope, options);
    if ('problem' in read) return report(read.problem);
    if (!(read.value instanceof Date || typeof read.value === 'string')) {
      return report('is not a date');
    }
    base = read.value;
  }

  try {
    const resolved =
      offsetSource !== undefined
        ? evaluateValue({ value: base, offset: offsetSource }, collected.values, evaluationOptions)
        : target.kind === 'expr'
          ? evaluateValue(base as DateExpr, collected.values, evaluationOptions)
          : base;

    if (resolved === null || resolved === undefined) {
      return report(offsetSource !== undefined ? 'offset resolved to nothing' : 'is not a date');
    }
    if (!(resolved instanceof Date || typeof resolved === 'string')) {
      return report('is not a date');
    }

    return escapeHtml(formatDate(resolved as DateInputValue, { format: token.format, timeZone }));
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (target.kind === 'path' && /invalid date value/i.test(message)) {
      return report('is not a date');
    }
    return report(message || 'is not a date');
  }
};
