/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import { check } from '@inixiative/json-rules';
import { type Branch, IF, parseIfBlock } from '@template/email/render/conditionParser';
import { escape as escapeHtml, get, isNil } from 'lodash-es';

export type RuleErrorSink = (message: string) => void;

export type Scope = Record<string, unknown>;

export type SettleOptions = { substitute: boolean };

const RESERVED_SCOPE_ROOTS: ReadonlySet<string> = new Set(['sender', 'recipient', 'data', 'system']);

const TOKEN_PATTERN = /\{\{([a-z][a-z0-9-]*)((?:\.[a-zA-Z0-9_-]+)*)\}\}/g;

const UNSAFE_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
const hasUnsafeSegment = (path: string): boolean =>
  path.split('.').some((segment) => UNSAFE_PATH_SEGMENTS.has(segment));

const inlineRenderErrors = (): boolean => process.env.EMAIL_INLINE_RENDER_ERRORS === 'true';

const toRuleData = (scope: Scope): Record<string, unknown> =>
  Object.fromEntries(Object.entries(scope).filter(([, value]) => value !== undefined));

const substituteToken = (
  match: string,
  root: string,
  segments: string,
  scope: Scope,
  onError?: RuleErrorSink,
): string => {
  const path = segments.slice(1);
  if (path && hasUnsafeSegment(path)) return match;

  if (RESERVED_SCOPE_ROOTS.has(root)) {
    if (!path) return match;
    const value = get(scope[root], path);
    if (isNil(value) || typeof value === 'function') return match;
    return escapeHtml(String(value));
  }

  if (!Object.hasOwn(scope, root)) return match;
  const value = path ? get(scope[root], path) : scope[root];
  if (isNil(value) || typeof value === 'function') return match;
  if (typeof value === 'object') {
    onError?.(`{{${root}${segments}}} resolved to a non-primitive value and was left unsubstituted`);
    return match;
  }
  return escapeHtml(String(value));
};

const settleText = (text: string, scope: Scope, options: SettleOptions, onError?: RuleErrorSink): string => {
  if (!options.substitute) return text;
  return text.replace(TOKEN_PATTERN, (match, root: string, segments: string) =>
    substituteToken(match, root, segments, scope, onError),
  );
};

const onBlockError = (
  message: string,
  body: string,
  scope: Scope,
  options: SettleOptions,
  onError?: RuleErrorSink,
): string | null => {
  onError?.(message);
  return inlineRenderErrors() ? `<!-- RULE ERROR: ${message} -->\n${settle(body, scope, options, onError)}` : null;
};

const settleBranches = (branches: Branch[], scope: Scope, options: SettleOptions, onError?: RuleErrorSink): string => {
  for (const branch of branches) {
    if (branch.kind === 'else') return settle(branch.body, scope, options, onError);

    if (branch.ruleError !== undefined) {
      const rendered = onBlockError(branch.ruleError, branch.body, scope, options, onError);
      if (rendered !== null) return rendered;
      continue;
    }

    try {
      if (check(branch.rule!, toRuleData(scope)) === true) return settle(branch.body, scope, options, onError);
    } catch (err) {
      const rendered = onBlockError(
        err instanceof Error ? err.message : 'Unknown error',
        branch.body,
        scope,
        options,
        onError,
      );
      if (rendered !== null) return rendered;
    }
  }

  return '';
};

export function settle(content: string, scope: Scope, options: SettleOptions, onError?: RuleErrorSink): string {
  let result = '';
  let i = 0;
  while (i < content.length) {
    const openIdx = content.indexOf(IF, i);
    if (openIdx === -1) {
      result += settleText(content.slice(i), scope, options, onError);
      break;
    }
    result += settleText(content.slice(i, openIdx), scope, options, onError);
    const block = parseIfBlock(content, openIdx);
    if (!block) {
      result += settleText(content.slice(openIdx), scope, options, onError);
      break;
    }
    result += settleBranches(block.branches, scope, options, onError);
    i = block.end;
  }
  return result;
}
