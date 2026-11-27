/**
 * @atlas
 * @kind utils
 * @partOf feature:email
 * @uses primitive:shared
 */
import {
  formatDate,
  validateDateFormat,
  validateValue,
  valueExpressionShape,
} from '@inixiative/json-rules';
import type { DatetimeToken } from '@template/email/render/conditionParser/datetimeTokenAt';
import { isTimezoneId } from '@template/shared/reference/timezones';
import { isPlainObject } from 'lodash-es';

const VALIDATION_BASE_ISO = '2026-01-01T00:00:00Z';

const expressionReferences = (
  expr: Record<string, unknown>,
): { paths: string[]; hasBind: boolean } => {
  const paths: string[] = [];
  let hasBind = false;
  for (const direction of ['ahead', 'ago'] as const) {
    const units = expr[direction];
    if (!isPlainObject(units)) continue;
    for (const amount of Object.values(units as Record<string, unknown>)) {
      if (!isPlainObject(amount)) continue;
      const source = amount as Record<string, unknown>;
      if (typeof source.path === 'string' && source.path) paths.push(source.path);
      if ('bind' in source || 'bindOptional' in source) hasBind = true;
    }
  }
  return { paths, hasBind };
};

export const datetimeExpressionPaths = (token: DatetimeToken): string[] => [
  ...(token.target?.kind === 'expr' ? expressionReferences(token.target.expr).paths : []),
  ...(token.offset ? expressionReferences(token.offset).paths : []),
];

export const datetimeTokenPaths = (token: DatetimeToken): string[] => [
  ...(token.target?.kind === 'path' ? [token.target.path] : []),
  ...datetimeExpressionPaths(token),
];

export const datetimeTokenLabel = (token: DatetimeToken): string => {
  const { target } = token;
  if (!target) return token.raw;
  switch (target.kind) {
    case 'path':
      return `{{datetime ${target.path}}}`;
    case 'now':
      return '{{datetime now}}';
    case 'literal':
      return `{{datetime ${JSON.stringify(target.value)}}}`;
    case 'expr':
      return `{{datetime ${JSON.stringify(target.expr)}}}`;
  }
};

export const datetimeTokenProblems = (token: DatetimeToken): string[] => {
  const problems: string[] = [...(token.errors ?? [])];

  if (token.format !== undefined && !validateDateFormat(token.format).ok) {
    problems.push(`has an invalid format: ${token.format}`);
  }
  const hasKnownTimeZone = token.timeZone === undefined || isTimezoneId(token.timeZone);
  if (!hasKnownTimeZone) {
    problems.push(`has an unknown time zone: ${token.timeZone}`);
  }

  if (token.target?.kind === 'literal') {
    const literalTimeZone = hasKnownTimeZone ? (token.timeZone ?? 'UTC') : 'UTC';
    try {
      formatDate(token.target.value, { timeZone: literalTimeZone });
    } catch {
      problems.push(`has an invalid date literal: ${token.target.value}`);
    }
  } else if (token.target?.kind === 'expr') {
    if (valueExpressionShape(token.target.expr) !== 'date') {
      problems.push('has an invalid date expression');
    } else {
      const checked = validateValue(token.target.expr);
      if (!checked.ok) {
        for (const issue of checked.errors) {
          problems.push(`has an invalid date expression: ${issue.message}`);
        }
      }
      if (expressionReferences(token.target.expr).hasBind) {
        problems.push('does not support bindings');
      }
    }
  }

  if (token.offset !== undefined) {
    if (valueExpressionShape(token.offset) !== 'date') {
      problems.push('has an invalid offset: must be a rolling ahead or ago offset');
    } else {
      const checked = validateValue({
        value: VALIDATION_BASE_ISO,
        offset: { value: token.offset },
      });
      if (!checked.ok) {
        for (const issue of checked.errors) {
          problems.push(`has an invalid offset: ${issue.message}`);
        }
      }
      if (expressionReferences(token.offset).hasBind) {
        problems.push('does not support bindings');
      }
    }
  }

  return problems;
};
