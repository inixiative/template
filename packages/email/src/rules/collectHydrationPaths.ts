/**
 * @atlas
 * @kind utils
 * @partOf feature:email
 * @uses primitive:shared
 */
import type { Condition } from '@inixiative/json-rules';
import {
  datetimeTokenPaths,
  RESERVED_SCOPE_ROOTS,
  TOKEN_PATTERN,
  visitTemplateBlocks,
  visitTextSegments,
} from '@template/email/render/conditionParser';
import type { BindingChain } from '@template/email/rules/resolveBindingPath';
import { resolveBindingPath } from '@template/email/rules/resolveBindingPath';
import { walkConditionTree } from '@template/email/rules/walkConditionTree';

const addPath = (out: Set<string>, prefix: string, field: unknown): void => {
  if (typeof field !== 'string' || !field) return;
  out.add(prefix ? `${prefix}.${field}` : field);
};

const addPathRef = (out: Set<string>, prefix: string, path: unknown): void => {
  if (typeof path !== 'string' || !path) return;
  if (path.startsWith('$.')) addPath(out, prefix, path.slice(2));
  else addPath(out, '', path);
};

const walkCondition = (cond: Condition | undefined, prefix: string, out: Set<string>): void => {
  walkConditionTree(cond, prefix, (leaf, currentPrefix) => {
    const node = leaf as Record<string, unknown>;

    if ('arrayOperator' in node || 'aggregate' in node) {
      addPath(out, currentPrefix, node.field);
      addPathRef(out, currentPrefix, node.path);
      const childPrefix =
        typeof node.field === 'string' && node.field
          ? currentPrefix
            ? `${currentPrefix}.${node.field}`
            : node.field
          : currentPrefix;
      const aggregate = node.aggregate as { field?: unknown } | undefined;
      if (typeof aggregate === 'object' && aggregate !== null)
        addPath(out, childPrefix, aggregate.field);
      if (Array.isArray(node.orderBy)) {
        for (const entry of node.orderBy as { field?: unknown }[]) {
          if (typeof entry === 'object' && entry !== null) addPath(out, childPrefix, entry.field);
        }
      }
      return [
        { condition: node.condition as Condition | undefined, context: childPrefix },
        { condition: node.filter as Condition | undefined, context: childPrefix },
      ];
    }

    addPath(out, currentPrefix, node.field);
    addPathRef(out, currentPrefix, node.path);
    return undefined;
  });
};

const collectRuleFieldPaths = (
  rule: Condition,
  bindings: BindingChain,
  out: CollectedPaths,
): void => {
  const raw = new Set<string>();
  walkCondition(rule, '', raw);
  for (const path of raw) {
    const resolved = resolveBindingPath(path, bindings);
    if (!resolved) continue;
    out.fieldPaths.add(resolved);
    out.rulePaths.add(resolved);
  }
};

type CollectedPaths = {
  fieldPaths: Set<string>;
  eachLoopPaths: Set<string>;
  rulePaths: Set<string>;
};

const addTokenPath = (path: string, bindings: BindingChain, out: Set<string>): void => {
  const root = path.split('.')[0] ?? '';
  if (!RESERVED_SCOPE_ROOTS.has(root) && !bindings.has(root)) return;
  const resolved = resolveBindingPath(path, bindings);
  if (resolved?.includes('.')) out.add(resolved);
};

const collectTokenPaths = (text: string, bindings: BindingChain, out: Set<string>): void => {
  visitTextSegments(text, {
    text: (slice) => {
      for (const [plain = ''] of slice.matchAll(TOKEN_PATTERN)) {
        addTokenPath(plain.slice(2, -2), bindings, out);
      }
    },
    datetime: (token) => {
      for (const path of datetimeTokenPaths(token)) addTokenPath(path, bindings, out);
    },
  });
};

const collectFromContent = (content: string, out: CollectedPaths): void =>
  visitTemplateBlocks(content, {
    text: (text, { bindings }) => collectTokenPaths(text, bindings, out.fieldPaths),
    branch: ({ rule }, _branchIndex, _position, { bindings }) => {
      if (rule) collectRuleFieldPaths(rule, bindings, out);
    },
    loop: ({ filter }, { iterated, bindings }) => {
      if (iterated) {
        out.fieldPaths.add(iterated);
        out.eachLoopPaths.add(iterated);
      }
      if (filter) collectRuleFieldPaths(filter, bindings, out);
    },
  });

export const collectHydrationPaths = (
  content: string,
): { fieldPaths: string[]; eachLoopPaths: string[]; rulePaths: string[] } => {
  const out: CollectedPaths = {
    fieldPaths: new Set(),
    eachLoopPaths: new Set(),
    rulePaths: new Set(),
  };
  collectFromContent(content, out);
  return {
    fieldPaths: [...out.fieldPaths],
    eachLoopPaths: [...out.eachLoopPaths],
    rulePaths: [...out.rulePaths],
  };
};

export const collectConditionFieldPaths = (content: string): string[] =>
  collectHydrationPaths(content).fieldPaths;
