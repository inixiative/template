import { escape, isNil } from 'lodash-es';
import { evaluateConditions } from '@template/email/render/evaluateConditions';

/**
 * Variable prefixes for email templates.
 * - sender.* - Auto-resolved from sender (platform or org)
 * - recipient.* - Auto-resolved from recipient user
 * - data.* - Explicit values from send call
 * - component:slug - Component inclusion (handled separately)
 */
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

/**
 * Interpolate variables in template string.
 * 1. Evaluates {{#if rule={...}}}...{{/if}} conditionals
 * 2. Substitutes {{sender.*}}, {{recipient.*}}, {{variable.*}}
 */
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
