/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import { evaluateConditions, type RuleErrorSink } from '@template/email/render/evaluateConditions';
import type { SystemTokenName } from '@template/email/render/systemTokens';
import { escape as escapeHtml, get, isNil } from 'lodash-es';

export enum VariablePrefix {
  sender = 'sender',
  recipient = 'recipient',
  data = 'data',
}

const VARIABLE_PATTERN = /\{\{(sender|recipient|data)\.([a-zA-Z0-9_.-]+)\}\}/g;

/** A single-segment `{{system.<name>}}` token. Deliberately narrower than `VARIABLE_PATTERN`: every
 * resolver is a leaf, so a deeper `{{system.a.b}}` has nothing to resolve to and stays literal —
 * `system` is not a caller-variable prefix. */
const SYSTEM_TOKEN_PATTERN = /\{\{system\.([a-zA-Z0-9_-]+)\}\}/g;

const UNSAFE_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
const hasUnsafeSegment = (path: string): boolean =>
  path.split('.').some((segment) => UNSAFE_PATH_SEGMENTS.has(segment));

const DATE_FORMAT = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' } as const;

/**
 * Reserved `system.*` tokens, resolved from the engine's own clock at send time — never from caller
 * variables, so neither a template nor a `variables.system` an attacker controls can override them. Only
 * this allowlist resolves; any other `system.*` token stays literal. `now` is human-readable body copy,
 * not a machine timestamp; `year` is the current year.
 *
 * UTC on purpose: the recipient's zone is unknown at render time, and the only alternative is the SENDING
 * host's calendar day — two workers in different regions would print different dates for the same send.
 * Both resolvers are handed the same instant, read once per render, so a render that straddles midnight
 * can't disagree with itself (two `{{system.now}}` printing different days, `year` and `now` straddling
 * New Year).
 *
 * Typed exhaustively over {@link SYSTEM_TOKENS} — the list a picker offers — so a token added there
 * without a resolver here fails the build.
 */
const SYSTEM_TOKEN_RESOLVERS: Record<SystemTokenName, (now: Date, locale?: string) => string> = {
  // A stored locale is an unconstrained string, so a malformed tag reaches this far and
  // `toLocaleDateString` answers it with a RangeError. That must not fail the whole send over a date in
  // body copy — a bad tag degrades to the runtime default instead.
  now: (now, locale) => {
    try {
      return now.toLocaleDateString(locale, DATE_FORMAT);
    } catch {
      return now.toLocaleDateString(undefined, DATE_FORMAT);
    }
  },
  year: (now) => String(now.getUTCFullYear()),
};

// Own-property narrowing: a bare index reaches `Object.prototype` for `{{system.__proto__}}` (a truthy
// non-function — invoking it throws) and an inherited method for `{{system.toString}}`.
const isSystemTokenName = (name: string): name is SystemTokenName => Object.hasOwn(SYSTEM_TOKEN_RESOLVERS, name);

export type Variables = {
  sender?: Record<string, unknown>;
  recipient?: Record<string, unknown>;
  data?: Record<string, unknown>;
};

export type InterpolateOptions = {
  /** BCP-47 locale for locale-aware `system.*` tokens (`system.now`). Pass the locale the template was
   * composed at, so a translated template's dates match its copy; `undefined` falls back to the runtime
   * default locale. */
  locale?: string;
  /** Rows the composed template's rules name that no longer resolve (`degradedRuleRefs`, template + expanded
   * components). A branch whose rule names one is a render error, never a match. */
  staleRefs?: ReadonlySet<string>;
};

/**
 * Runs BEFORE conditionals and substitution, never after. The variable pass scans the original string
 * once and never rescans its own output, so a trailing `system` pass would be the second pass that lets a
 * caller value whose text contains `{{system.now}}` resolve. Running first also keeps `system` out of the
 * scope `{{#if rule=}}` paths can address.
 */
const resolveSystemTokens = (template: string, options: InterpolateOptions): string => {
  const now = new Date();

  return template.replace(SYSTEM_TOKEN_PATTERN, (match, name: string) =>
    isSystemTokenName(name) ? escapeHtml(SYSTEM_TOKEN_RESOLVERS[name](now, options.locale)) : match,
  );
};

export const interpolate = (
  template: string,
  variables: Variables,
  onError?: RuleErrorSink,
  options: InterpolateOptions = {},
): string => {
  const evaluated = evaluateConditions(resolveSystemTokens(template, options), variables, onError, options.staleRefs);

  return evaluated.replace(VARIABLE_PATTERN, (match, prefix, path) => {
    if (hasUnsafeSegment(path)) return match;
    const value = get(variables[prefix as keyof Variables], path);
    if (isNil(value) || typeof value === 'function') return match;
    return escapeHtml(String(value));
  });
};
