/**
 * @atlas
 * @kind utils
 * @partOf feature:email
 * @uses none
 */
import { type ScopeRoot, visitTextSegments } from '@template/email/render/conditionParser';
import {
  evaluateTemplateBlocksAndTokens,
  type RuleErrorSink,
  type Scope,
} from '@template/email/render/evaluateTemplate';
import type { SystemTokenName } from '@template/email/render/systemTokens';
import { type EmailLens, narrowVariables } from '@template/email/rules/emailLens';
import { escape as escapeHtml } from 'lodash-es';

export type Variables = Partial<Record<ScopeRoot, Record<string, unknown>>>;

export type InterpolateOptions = {
  locale?: string;
  existingTargets?: ReadonlySet<string>;
  lens: EmailLens;
  now?: Date;
};

const SYSTEM_TOKEN_PATTERN = /\{\{system\.([a-zA-Z0-9_-]+)\}\}/g;

const DATE_FORMAT = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' } as const;

const SYSTEM_TOKEN_RESOLVERS: Record<SystemTokenName, (now: Date, locale?: string) => string> = {
  now: (now, locale) => {
    try {
      return now.toLocaleDateString(locale, DATE_FORMAT);
    } catch {
      return now.toLocaleDateString(undefined, DATE_FORMAT);
    }
  },
  year: (now) => String(now.getUTCFullYear()),
  platformName: () => process.env.PROJECT_NAME ?? 'Template',
  webUrl: () => process.env.WEB_URL ?? '',
};

const reservedSystemValues = (now: Date): Record<SystemTokenName, unknown> => ({
  now,
  year: now.getUTCFullYear(),
  platformName: process.env.PROJECT_NAME ?? 'Template',
  webUrl: process.env.WEB_URL ?? '',
});

const isSystemTokenName = (name: string): name is SystemTokenName =>
  Object.hasOwn(SYSTEM_TOKEN_RESOLVERS, name);

const resolveSystemTokens = (template: string, now: Date, options: InterpolateOptions): string => {
  let out = '';
  visitTextSegments(template, {
    text: (slice) => {
      out += slice.replace(SYSTEM_TOKEN_PATTERN, (match, name: string) =>
        isSystemTokenName(name)
          ? escapeHtml(SYSTEM_TOKEN_RESOLVERS[name](now, options.locale))
          : match,
      );
    },
    datetime: (token) => {
      out += token.raw;
    },
  });
  return out;
};

export const toScope = (variables: Variables): Scope => ({ ...variables });

export const interpolate = (
  template: string,
  variables: Variables,
  onError: RuleErrorSink | undefined,
  options: InterpolateOptions,
): string => {
  const { lens } = options;
  const now = options.now ?? new Date();
  const scopedVariables: Variables = lens.system
    ? { ...variables, system: { ...variables.system, ...reservedSystemValues(now) } }
    : variables;
  const scope = toScope(narrowVariables(lens, scopedVariables));
  const ruleScope = toScope(narrowVariables(lens, scopedVariables, { keepClampColumns: true }));
  return evaluateTemplateBlocksAndTokens(
    resolveSystemTokens(template, now, options),
    scope,
    { substitute: true, existingTargets: options.existingTargets, lens, ruleScope, now },
    onError,
  );
};
