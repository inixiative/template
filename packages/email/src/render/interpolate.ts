/**
 * Variable prefixes for email templates.
 * - sender.* - Auto-resolved from sender (platform or org)
 * - recipient.* - Auto-resolved from recipient user
 * - variable.* - Explicit values from send call
 * - component:slug - Component inclusion (handled separately)
 */
export enum VariablePrefix {
  sender = 'sender',
  recipient = 'recipient',
  variable = 'variable',
}

const VARIABLE_PATTERN = /\{\{(sender|recipient|variable)\.(\w+)\}\}/g;

type Variables = {
  sender?: Record<string, unknown>;
  recipient?: Record<string, unknown>;
  variable?: Record<string, unknown>;
};

/**
 * Interpolate variables in template string.
 * Supports: {{sender.name}}, {{recipient.email}}, {{variable.code}}
 */
export const interpolate = (template: string, variables: Variables): string => {
  return template.replace(VARIABLE_PATTERN, (match, prefix, key) => {
    const source = variables[prefix as keyof Variables];
    const value = source?.[key];

    if (value === undefined || value === null) {
      return match; // Keep placeholder if value not found
    }

    // HTML escape to prevent XSS
    return escapeHtml(String(value));
  });
};

const escapeHtml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};
