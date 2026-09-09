/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import { type RuleErrorSink, type Scope, settle } from '@template/email/render/settle';
import type { SystemTokenName } from '@template/email/render/systemTokens';
import { escape as escapeHtml } from 'lodash-es';

export enum Lens {
  sender = 'sender',
  recipient = 'recipient',
  data = 'data',
  system = 'system',
}

export type Variables = {
  sender?: Record<string, unknown>;
  recipient?: Record<string, unknown>;
  data?: Record<string, unknown>;
  system?: Record<string, unknown>;
};

export type InterpolateOptions = {
  locale?: string;
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
};

const isSystemTokenName = (name: string): name is SystemTokenName => Object.hasOwn(SYSTEM_TOKEN_RESOLVERS, name);

const resolveSystemTokens = (template: string, options: InterpolateOptions): string => {
  const now = new Date();

  return template.replace(SYSTEM_TOKEN_PATTERN, (match, name: string) =>
    isSystemTokenName(name) ? escapeHtml(SYSTEM_TOKEN_RESOLVERS[name](now, options.locale)) : match,
  );
};

export const toScope = (variables: Variables): Scope => ({
  sender: variables.sender,
  recipient: variables.recipient,
  data: variables.data,
  system: variables.system,
});

export const interpolate = (
  template: string,
  variables: Variables,
  onError?: RuleErrorSink,
  options: InterpolateOptions = {},
): string => settle(resolveSystemTokens(template, options), toScope(variables), { substitute: true }, onError);
