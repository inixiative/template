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

export const RESERVED_SCOPE_ROOTS: ReadonlySet<string> = new Set(['sender', 'recipient', 'data', 'system']);

export const TOKEN_PATTERN = /\{\{([a-z][a-z0-9-]*)((?:\.[a-zA-Z0-9_-]+)*)\}\}/g;

const GRAMMAR_KEYWORDS = ['else', 'if', 'each', 'as', 'index', 'rule', 'filter'] as const;

export const RESERVED_BINDING_NAMES: ReadonlySet<string> = new Set([...RESERVED_SCOPE_ROOTS, ...GRAMMAR_KEYWORDS]);

export const isValidBindingIdentifier = (value: string): boolean => /^[a-z]/.test(value) && SLUG_PATTERN.test(value);
