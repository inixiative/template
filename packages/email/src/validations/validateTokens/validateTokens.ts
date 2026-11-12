/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses none
 */
import type { TokenIssue } from '@template/email/errors/TokenValidationError';
import {
  RESERVED_SCOPE_ROOTS,
  TOKEN_PATTERN,
  visitTemplateBlocks,
} from '@template/email/render/conditionParser';
import { SYSTEM_TOKENS } from '@template/email/render/systemTokens';
import { absoluteRule } from '@template/email/rules/absoluteRule';
import { isRailProvidedSystemField } from '@template/email/rules/railProvidedSystemFields';
import { type BindingChain, resolveBindingPath } from '@template/email/rules/resolveBindingPath';
import { presenceGuards } from '@template/email/validations/validateTokens/presenceGuards';
import { emailTokenPathKind } from '@template/email/validations/validateTokens/tokenPathKind';
import type { ValidateTokensOptions } from '@template/email/validations/validateTokens/types';
import { unknownMustaches } from '@template/email/validations/validateTokens/unknownMustaches';

const SYSTEM_TOKEN_NAMES = new Set<string>(SYSTEM_TOKENS.map(({ name }) => name));

type Walk = {
  bindings: BindingChain;
  eachRoots: Set<string>;
  guarded: Set<string>;
  issues: TokenIssue[];
  options: ValidateTokensOptions;
};

const segmentCount = (path: string): number => path.split('.').length;

const isGuarded = (path: string, optionalDepth: number, guarded: Set<string>): boolean => {
  for (const guard of guarded) {
    if (path !== guard && !path.startsWith(`${guard}.`)) continue;
    if (segmentCount(guard) >= optionalDepth) return true;
  }
  return false;
};

const tokenProblem = (
  token: string,
  root: string,
  segments: string,
  walk: Walk,
): string | undefined => {
  if (root === 'system' && !walk.options.lens) {
    const name = segments.slice(1);
    if (!name.includes('.') && (SYSTEM_TOKEN_NAMES.has(name) || isRailProvidedSystemField(name)))
      return undefined;
    return 'is not a system token the rail provides';
  }

  const viaEach = walk.bindings.has(root);
  if (!viaEach && !RESERVED_SCOPE_ROOTS.has(root)) {
    return 'names no scope root (sender, recipient, data, system) or enclosing {{#each}} binding';
  }
  const resolved = resolveBindingPath(token, walk.bindings);
  if (resolved === undefined) return segments ? 'reads a field off a loop index' : undefined;
  if (!walk.options.lens) return undefined;

  const kind = emailTokenPathKind(resolved, walk.options.lens, walk.eachRoots.has(root) || viaEach);
  switch (kind.kind) {
    case 'missing':
      return `"${resolved}" is not provided by this template's lens`;
    case 'pastScalar':
      return `"${resolved}" reads through a scalar`;
    case 'listWithoutEach':
      return `"${resolved}" reads through a list — iterate it with {{#each}}`;
    case 'object':
      return viaEach && !segments
        ? 'names the loop element, which is an object — pick a field'
        : `"${resolved}" is an object, not a value — pick a field`;
    case 'ok':
      if (viaEach && !segments && !kind.scalarList)
        return 'names the loop element, which is an object — pick a field';
      if (!viaEach && kind.scalarList) return `"${resolved}" is a list — iterate it with {{#each}}`;
      if (kind.optionalDepth > 0 && !isGuarded(resolved, kind.optionalDepth, walk.guarded)) {
        return `"${resolved}" may be empty — guard it with {{#if rule={"field":"${resolved}","operator":"exists"}}} … {{else}} … {{/if}}`;
      }
      return undefined;
  }
};

const checkText = (text: string, walk: Walk): void => {
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const root = match[1];
    const segments = match[2] ?? '';
    if (!root) continue;
    const token = `${root}${segments}`;
    const message = tokenProblem(token, root, segments, walk);
    if (message) walk.issues.push({ path: `{{${token}}}`, message });
  }
};

const walkContent = (content: string, walk: Omit<Walk, 'bindings'>): void =>
  visitTemplateBlocks(
    content,
    {
      text: (text, { bindings, state }) => checkText(text, { ...state, bindings }),
      branch: ({ kind, rule }, _branchIndex, _position, { bindings, state }) => {
        const guarded = new Set(state.guarded);
        if (kind !== 'else' && rule !== undefined) {
          const judged = absoluteRule(rule, bindings);
          if (judged) for (const guard of presenceGuards(judged)) guarded.add(guard);
        }
        return { ...state, guarded };
      },
      loop: ({ as }, _loop, { openIdx }, { state }) => {
        if (state.options.isSubject) {
          state.issues.push({
            path: `offset ${openIdx}`,
            message: '{{#each}} is not allowed in the subject line',
          });
        }
        const eachRoots = new Set(state.eachRoots);
        if (as) eachRoots.add(as);
        return { ...state, eachRoots };
      },
    },
    { bindings: new Map(), state: walk },
  );

export const validateTokens = (
  content: string,
  options: ValidateTokensOptions = {},
): TokenIssue[] => {
  const issues: TokenIssue[] = [];
  for (const offset of unknownMustaches(content)) {
    issues.push({
      path: `offset ${offset}`,
      message: `"${content.slice(offset, offset + 24)}" is not a token or block the engine understands`,
    });
  }
  walkContent(content, {
    eachRoots: new Set(),
    guarded: new Set(),
    issues,
    options,
  });
  return issues;
};
