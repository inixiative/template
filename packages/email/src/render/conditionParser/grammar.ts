/**
 * @atlas
 * @kind parser
 * @partOf feature:email
 * @uses none
 */
import { SLUG_PATTERN } from '@template/email/render/blockTags';

export const IF = '{{#if rule=';
export const ELSE_IF = '{{else if rule=';
export const ELSE = '{{else}}';
export const END = '{{/if}}';

export const EACH = '{{#each ';
export const END_EACH = '{{/each}}';

export const DATETIME = '{{datetime ';

export const SCOPE_ROOTS = ['sender', 'recipient', 'data', 'system'] as const;

export type ScopeRoot = (typeof SCOPE_ROOTS)[number];

export const RESERVED_SCOPE_ROOTS: ReadonlySet<string> = new Set(SCOPE_ROOTS);

const TOKEN_PATH_SOURCE = '([a-z][a-z0-9-]*)((?:\\.[a-zA-Z0-9_-]+)*)';

export const TOKEN_PATH_PATTERN = new RegExp(`^${TOKEN_PATH_SOURCE}$`);

export const TOKEN_PATTERN = new RegExp(`\\{\\{${TOKEN_PATH_SOURCE}\\}\\}`, 'g');

const GRAMMAR_KEYWORDS = [
  'else',
  'if',
  'each',
  'as',
  'index',
  'rule',
  'filter',
  'datetime',
] as const;

export const RESERVED_BINDING_NAMES: ReadonlySet<string> = new Set([
  ...RESERVED_SCOPE_ROOTS,
  ...GRAMMAR_KEYWORDS,
]);

export const isValidBindingIdentifier = (value: string): boolean =>
  /^[a-z]/.test(value) && SLUG_PATTERN.test(value);
