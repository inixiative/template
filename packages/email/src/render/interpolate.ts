/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import { evaluateConditions, type RuleErrorSink } from '@template/email/render/evaluateConditions';
import { escape as escapeHtml, get, isNil } from 'lodash-es';

export enum Lens {
  sender = 'sender',
  recipient = 'recipient',
  data = 'data',
  system = 'system',
}

const VARIABLE_PATTERN = /\{\{(sender|recipient|data|system)\.([a-zA-Z0-9_.-]+)\}\}/g;

const UNSAFE_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
const hasUnsafeSegment = (path: string): boolean =>
  path.split('.').some((segment) => UNSAFE_PATH_SEGMENTS.has(segment));

export type Variables = {
  sender?: Record<string, unknown>;
  recipient?: Record<string, unknown>;
  data?: Record<string, unknown>;
  system?: Record<string, unknown>;
};

export const interpolate = (template: string, variables: Variables, onError?: RuleErrorSink): string => {
  const evaluated = evaluateConditions(template, variables, onError);

  return evaluated.replace(VARIABLE_PATTERN, (match, prefix, path) => {
    if (hasUnsafeSegment(path)) return match;
    const value = get(variables[prefix as keyof Variables], path);
    if (isNil(value) || typeof value === 'function') return match;
    return escapeHtml(String(value));
  });
};
