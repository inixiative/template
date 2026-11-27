/**
 * @atlas
 * @kind utils
 * @partOf feature:email
 * @uses primitive:shared
 */
import { isDatetimeFormat } from '@template/email/render/conditionParser';
import { readTokenValue } from '@template/email/render/evaluateTemplate/readTokenValue';
import type {
  RuleErrorSink,
  Scope,
  TemplateEvaluationOptions,
} from '@template/email/render/evaluateTemplate/types';
import { splitRoot } from '@template/email/rules/emailLens';
import { isTimezoneId } from '@template/shared/reference/timezones';
import { formatInTimeZone } from 'date-fns-tz';
import { escape as escapeHtml } from 'lodash-es';

const ISO_8601_FORMAT = "yyyy-MM-dd'T'HH:mm:ssXXX";

export const substituteDatetimeToken = (
  path: string,
  format: string | undefined,
  timeZone: string | undefined,
  scope: Scope,
  onError?: RuleErrorSink,
  options?: TemplateEvaluationOptions,
): string => {
  const report = (detail: string): string => {
    onError?.({ kind: 'token', path, detail: `{{datetime ${path}}} ${detail}` });
    return '';
  };
  if (format !== undefined && !isDatetimeFormat(format)) {
    return report(`has an invalid format: ${format}`);
  }
  if (timeZone !== undefined && !isTimezoneId(timeZone)) {
    return report(`has an unknown time zone: ${timeZone}`);
  }
  const { root, rest } = splitRoot(path);
  const read = readTokenValue(root, rest, scope, options);
  if ('problem' in read) return report(read.problem);
  const { value } = read;
  const at = value instanceof Date || typeof value === 'string' ? new Date(value) : null;
  if (!at || Number.isNaN(at.getTime())) return report('is not a date');
  return escapeHtml(formatInTimeZone(at, timeZone ?? 'UTC', format ?? ISO_8601_FORMAT));
};
