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
import { splitRoot } from '@template/email/rules/emailLens';
import { isTimezoneId } from '@template/shared/reference/timezones';
import { formatDateTimeShort } from '@template/shared/utils/formatDateTimeShort';
import { escape as escapeHtml } from 'lodash-es';

const formatted = (value: unknown, timeZone: string | undefined): string | null => {
  if (!(value instanceof Date) && typeof value !== 'string') return null;
  return formatDateTimeShort(value, timeZone && isTimezoneId(timeZone) ? timeZone : 'UTC');
};

export const substituteDatetimeToken = (
  path: string,
  timeZone: string | undefined,
  scope: Scope,
  onError?: RuleErrorSink,
  options?: TemplateEvaluationOptions,
): string => {
  const { root, rest } = splitRoot(path);
  const read = readTokenValue(root, rest, scope, options);
  const printed = 'value' in read ? formatted(read.value, timeZone) : null;
  if (printed) return escapeHtml(printed);
  const detail = 'problem' in read ? read.problem : 'is not a date';
  onError?.({ kind: 'token', path, detail: `{{datetime ${path}}} ${detail}` });
  return '';
};
