/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import { evaluateConditions, type RuleErrorSink } from '@template/email/render/evaluateConditions';
import { escape, get, isNil } from 'lodash-es';

export enum VariablePrefix {
  sender = 'sender',
  recipient = 'recipient',
  data = 'data',
}

const VARIABLE_PATTERN = /\{\{(sender|recipient|data)\.([a-zA-Z0-9_.-]+)\}\}/g;

export type Variables = {
  sender?: Record<string, unknown>;
  recipient?: Record<string, unknown>;
  data?: Record<string, unknown>;
};

export const interpolate = (template: string, variables: Variables, onError?: RuleErrorSink): string => {
  const evaluated = evaluateConditions(template, variables, onError);

  return evaluated.replace(VARIABLE_PATTERN, (match, prefix, path) => {
    const value = get(variables[prefix as keyof Variables], path);
    if (isNil(value)) return match;
    return escape(String(value));
  });
};
