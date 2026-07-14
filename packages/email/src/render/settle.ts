/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import { check } from '@inixiative/json-rules';
import {
  type Branch,
  EACH,
  type EachBlock,
  END_EACH,
  IF,
  isValidBindingIdentifier,
  parseEachBlock,
  parseIfBlock,
  RESERVED_BINDING_NAMES,
} from '@template/email/render/conditionParser';
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

const sinkOrphanEachCloses = (text: string, onError?: RuleErrorSink): void => {
  if (!onError) return;
  let idx = text.indexOf(END_EACH);
  while (idx !== -1) {
    onError('stray {{/each}} with no matching {{#each}}');
    idx = text.indexOf(END_EACH, idx + END_EACH.length);
  }
};

const settleText = (text: string, scope: Scope, options: SettleOptions, onError?: RuleErrorSink): string => {
  sinkOrphanEachCloses(text, onError);
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

const resolvePath = (path: string, scope: Scope): unknown => {
  const dot = path.indexOf('.');
  const root = dot === -1 ? path : path.slice(0, dot);
  if (!Object.hasOwn(scope, root)) return undefined;
  const base = scope[root];
  return dot === -1 ? base : get(base, path.slice(dot + 1));
};

const settleEach = (block: EachBlock, scope: Scope, options: SettleOptions, onError?: RuleErrorSink): string => {
  if (block.attributeErrors?.length) {
    for (const message of block.attributeErrors) onError?.(message);
    return '';
  }
  if (block.asMissing || !block.as || !isValidBindingIdentifier(block.as)) {
    onError?.('missing or invalid as= attribute on {{#each}} block');
    return '';
  }
  if (RESERVED_BINDING_NAMES.has(block.as) || Object.hasOwn(scope, block.as)) {
    onError?.(`as= "${block.as}" collides with a reserved or enclosing binding`);
    return '';
  }
  const as = block.as;
  const index = block.index;
  if (index !== undefined && !isValidBindingIdentifier(index)) {
    onError?.('invalid index= attribute on {{#each}} block');
    return '';
  }
  if (index !== undefined && (RESERVED_BINDING_NAMES.has(index) || Object.hasOwn(scope, index) || index === as)) {
    onError?.(`index= "${index}" collides with a reserved or enclosing binding`);
    return '';
  }
  if (block.filterError !== undefined) {
    onError?.(`invalid filter JSON - ${block.filterError}`);
    return inlineRenderErrors()
      ? `<!-- RULE ERROR: ${block.filterError} -->\n${settle(block.body, scope, options, onError)}`
      : '';
  }

  const arrayValue = resolvePath(block.path, scope);
  if (!Array.isArray(arrayValue)) {
    onError?.(`{{#each ${block.path}}} did not resolve to an array`);
    return '';
  }

  const emitted: unknown[] = [];
  let filterThrew = false;
  let firstThrowMessage: string | undefined;
  for (const element of arrayValue) {
    if (!block.filter) {
      emitted.push(element);
      continue;
    }
    try {
      if (check(block.filter, toRuleData({ ...scope, [as]: element })) === true) emitted.push(element);
    } catch (err) {
      filterThrew = true;
      firstThrowMessage ??= err instanceof Error ? err.message : 'Unknown error';
    }
  }

  if (filterThrew) {
    onError?.(firstThrowMessage!);
    if (inlineRenderErrors()) {
      return `<!-- RULE ERROR: ${firstThrowMessage} -->\n${settle(block.body, scope, options, onError)}`;
    }
  }

  let out = '';
  emitted.forEach((element, position) => {
    const elementScope: Scope = { ...scope, [as]: element };
    if (index) elementScope[index] = position;
    out += settle(block.body, elementScope, options, onError);
  });
  return out;
};

export function settle(content: string, scope: Scope, options: SettleOptions, onError?: RuleErrorSink): string {
  let result = '';
  let i = 0;
  while (i < content.length) {
    const ifIdx = content.indexOf(IF, i);
    const eachIdx = content.indexOf(EACH, i);
    if (ifIdx === -1 && eachIdx === -1) {
      result += settleText(content.slice(i), scope, options, onError);
      return result;
    }

    const isEach = eachIdx !== -1 && (ifIdx === -1 || eachIdx < ifIdx);
    const openIdx = isEach ? eachIdx : ifIdx;
    result += settleText(content.slice(i, openIdx), scope, options, onError);

    if (isEach) {
      const block = parseEachBlock(content, openIdx);
      if (!block) {
        onError?.('unterminated {{#each}} block - missing {{/each}}');
        result += settleText(content.slice(openIdx), scope, options, onError);
        return result;
      }
      result += settleEach(block, scope, options, onError);
      i = block.end;
    } else {
      const block = parseIfBlock(content, openIdx);
      if (!block) {
        result += settleText(content.slice(openIdx), scope, options, onError);
        return result;
      }
      result += settleBranches(block.branches, scope, options, onError);
      i = block.end;
    }
  }
  return result;
}
