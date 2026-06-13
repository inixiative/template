/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import { evaluateConditions } from '@template/email/render/evaluateConditions';
// biome-ignore lint/suspicious/noShadowRestrictedNames: lodash escape is the intended import
import { escape, isNil } from 'lodash-es';

export enum VariablePrefix {
  sender = 'sender',
  recipient = 'recipient',
  data = 'data',
}

const VARIABLE_PATTERN = /\{\{(sender|recipient|data)\.([a-zA-Z0-9_-]+)\}\}/g;

export type Variables = {
  sender?: Record<string, unknown>;
  recipient?: Record<string, unknown>;
  data?: Record<string, unknown>;
};

export const interpolate = (template: string, variables: Variables): string => {
  // 1. Evaluate conditionals
  const evaluated = evaluateConditions(template, variables);

  // 2. Substitute variables
  return evaluated.replace(VARIABLE_PATTERN, (match, prefix, key) => {
    const source = variables[prefix as keyof Variables];
    const value = source?.[key];

    if (isNil(value)) {
      return match;
    }

    return escape(String(value));
  });
};
