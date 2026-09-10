/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses none
 */
import type { TokenIssue } from '@template/email/errors/TokenValidationError';
import {
  EACH,
  IF,
  parseEachBlock,
  parseIfBlock,
  RESERVED_SCOPE_ROOTS,
  TOKEN_PATTERN,
} from '@template/email/render/conditionParser';
import { SYSTEM_TOKENS } from '@template/email/render/systemTokens';
import { absoluteRule } from '@template/email/rules/absoluteRule';
import { isRailProvidedSystemField } from '@template/email/rules/railProvidedSystemFields';
import { type BindingChain, resolveBindingPath } from '@template/email/rules/resolveBindingPath';
import { presenceGuards } from '@template/email/validations/validateTokens/presenceGuards';
import { tokenPathKind } from '@template/email/validations/validateTokens/tokenPathKind';
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

const checkToken = (token: string, root: string, segments: string, walk: Walk): void => {
  const issue = (message: string): void => {
    walk.issues.push({ path: `{{${token}}}`, message });
  };

  if (root === 'system') {
    const name = segments.slice(1);
    if (!name.includes('.') && (SYSTEM_TOKEN_NAMES.has(name) || isRailProvidedSystemField(name))) return;
    return issue('is not a system token the rail provides');
  }

  const viaEach = walk.bindings.has(root);
  if (!viaEach && !RESERVED_SCOPE_ROOTS.has(root)) {
    return issue('names no scope root (sender, recipient, data, system) or enclosing {{#each}} binding');
  }
  const resolved = resolveBindingPath(token, walk.bindings);
  if (resolved === undefined) {
    if (!segments) return;
    return issue('reads a field off a loop index');
  }
  if (!walk.options.lens) return;

  const kind = tokenPathKind(resolved, walk.options.lens, walk.eachRoots.has(root) || viaEach);
  switch (kind.kind) {
    case 'missing':
      return issue(`"${resolved}" is not provided by this template's lens`);
    case 'pastScalar':
      return issue(`"${resolved}" reads through a scalar`);
    case 'listWithoutEach':
      return issue(`"${resolved}" reads through a list — iterate it with {{#each}}`);
    case 'object':
      return issue(
        viaEach && !segments
          ? 'names the loop element, which is an object — pick a field'
          : `"${resolved}" is an object, not a value — pick a field`,
      );
    case 'ok':
      if (viaEach && !segments && !kind.scalarList)
        return issue('names the loop element, which is an object — pick a field');
      if (kind.optionalDepth > 0 && !isGuarded(resolved, kind.optionalDepth, walk.guarded)) {
        return issue(
          `"${resolved}" may be empty — guard it with {{#if rule={"field":"${resolved}","operator":"exists"}}} … {{else}} … {{/if}}`,
        );
      }
      return;
  }
};

const checkText = (text: string, walk: Walk): void => {
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const root = match[1];
    const segments = match[2] ?? '';
    if (root) checkToken(`${root}${segments}`, root, segments, walk);
  }
};

const walkContent = (content: string, walk: Walk): void => {
  let i = 0;
  while (i < content.length) {
    const ifIdx = content.indexOf(IF, i);
    const eachIdx = content.indexOf(EACH, i);
    if (ifIdx === -1 && eachIdx === -1) break;
    const kind: 'if' | 'each' = eachIdx === -1 || (ifIdx !== -1 && ifIdx < eachIdx) ? 'if' : 'each';
    const openIdx = kind === 'if' ? ifIdx : eachIdx;
    checkText(content.slice(i, openIdx), walk);

    if (kind === 'if') {
      const block = parseIfBlock(content, openIdx);
      if (!block) {
        i = openIdx + IF.length;
        continue;
      }
      for (const branch of block.branches) {
        const guarded = new Set(walk.guarded);
        if (branch.kind !== 'else' && branch.rule !== undefined) {
          const judged = absoluteRule(branch.rule, walk.bindings);
          if (judged) for (const guard of presenceGuards(judged)) guarded.add(guard);
        }
        walkContent(branch.body, { ...walk, guarded });
      }
      i = block.end;
      continue;
    }

    const block = parseEachBlock(content, openIdx);
    if (!block) {
      i = openIdx + EACH.length;
      continue;
    }
    const bindings: BindingChain = new Map(walk.bindings);
    const eachRoots = new Set(walk.eachRoots);
    if (block.as) {
      bindings.set(block.as, resolveBindingPath(block.path, walk.bindings));
      eachRoots.add(block.as);
    }
    if (block.index) bindings.set(block.index, undefined);
    walkContent(block.body, { ...walk, bindings, eachRoots });
    i = block.end;
  }
  checkText(content.slice(i), walk);
};

export const validateTokens = (content: string, options: ValidateTokensOptions = {}): TokenIssue[] => {
  const issues: TokenIssue[] = [];
  for (const offset of unknownMustaches(content)) {
    issues.push({
      path: `offset ${offset}`,
      message: `"${content.slice(offset, offset + 24)}" is not a token or block the engine understands`,
    });
  }
  walkContent(content, { bindings: new Map(), eachRoots: new Set(), guarded: new Set(), issues, options });
  return issues;
};
