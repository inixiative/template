/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses primitive:shared
 */
import {
  type Condition,
  checkRuleAgainstLens,
  type Lens,
  type LensNarrowing,
  validateRule,
} from '@inixiative/json-rules';
import {
  type Branch,
  EACH,
  IF,
  isStructurallyBalanced,
  isValidBindingIdentifier,
  parseEachBlock,
  parseIfBlock,
  RESERVED_BINDING_NAMES,
  RESERVED_SCOPE_ROOTS,
} from '@template/email/render/conditionParser';
import { EACH_MAX_DEPTH } from '@template/email/render/limits';
import { type Node, parseBlocks } from '@template/email/render/parseBlocks';
import { type BindingChain, resolveBindingPath } from '@template/email/rules/resolveBindingPath';
import { walkConditionTree } from '@template/email/rules/walkConditionTree';

export type ConditionIssue = { path: string; message: string };

export type ValidateConditionsOptions = {
  isSubject?: boolean;
  lens?: Lens | LensNarrowing;
};

type ConditionNode = Record<string, unknown>;

const collectContextPathRoots = (cond: Condition | undefined, out: Set<string>): void => {
  walkConditionTree(cond, out, (leaf, roots) => {
    const node = leaf as ConditionNode;
    if (typeof node.path === 'string' && node.path && !node.path.startsWith('$.')) roots.add(node.path.split('.')[0]!);
    return [
      { condition: node.condition as Condition | undefined, context: roots },
      { condition: node.filter as Condition | undefined, context: roots },
    ];
  });
};

const desugarLeafForLens = (node: ConditionNode, bindingScope: BindingChain): ConditionNode | undefined => {
  if (typeof node.field !== 'string' || !node.field) return undefined;
  const rewritten: ConditionNode = { ...node };
  for (const key of ['field', 'path'] as const) {
    const raw = node[key];
    if (typeof raw !== 'string' || !raw) continue;
    const resolved = resolveBindingPath(raw, bindingScope);
    if (resolved === undefined) return undefined;
    if (!RESERVED_SCOPE_ROOTS.has(resolved.split('.')[0]!)) return undefined;
    rewritten[key] = resolved;
  }
  return rewritten;
};

const validateFieldRoots = (
  rule: Condition,
  lens: Lens | LensNarrowing | undefined,
  bindingScope: BindingChain,
  path: string,
  issues: ConditionIssue[],
): void => {
  const bindingRoots = new Set<string>();
  const contextPathRoots = new Set<string>();
  collectContextPathRoots(rule, contextPathRoots);
  for (const root of contextPathRoots) {
    if (!RESERVED_SCOPE_ROOTS.has(root)) bindingRoots.add(root);
  }

  walkConditionTree(rule, undefined, (leaf) => {
    const node = leaf as ConditionNode;
    if (typeof node.field === 'string' && node.field) {
      const root = node.field.split('.')[0]!;
      if (!RESERVED_SCOPE_ROOTS.has(root)) bindingRoots.add(root);
    }
    if (!lens) return undefined;
    const rewritten = desugarLeafForLens(node, bindingScope);
    if (rewritten) {
      for (const violation of checkRuleAgainstLens(rewritten as Condition, lens).violations) {
        issues.push({ path: `${path}:${violation.path}`, message: violation.reason });
      }
    }
    return undefined;
  });

  for (const root of bindingRoots) {
    if (!bindingScope.has(root)) {
      issues.push({
        path,
        message: `references unknown binding "${root}" — not the current or an enclosing {{#each}}'s as=`,
      });
    }
  }
};

const validateEachAttributes = (
  block: { as?: string; asMissing?: boolean; index?: string; path: string; attributeErrors?: string[] },
  bindingScope: BindingChain,
  path: string,
  issues: ConditionIssue[],
): void => {
  for (const message of block.attributeErrors ?? []) issues.push({ path, message });

  if (block.asMissing || !block.as) {
    issues.push({ path, message: 'missing as= attribute on {{#each}} block' });
  } else {
    if (!isValidBindingIdentifier(block.as)) {
      issues.push({ path, message: `as= "${block.as}" is not a valid identifier — must match ^[a-z][a-z0-9-]*$` });
    }
    if (RESERVED_BINDING_NAMES.has(block.as)) {
      issues.push({ path, message: `as= "${block.as}" collides with a reserved word` });
    } else if (bindingScope.has(block.as)) {
      issues.push({ path, message: `as= "${block.as}" collides with an enclosing {{#each}}'s binding` });
    }
  }

  if (block.index !== undefined) {
    if (!isValidBindingIdentifier(block.index)) {
      issues.push({
        path,
        message: `index= "${block.index}" is not a valid identifier — must match ^[a-z][a-z0-9-]*$`,
      });
    }
    if (RESERVED_BINDING_NAMES.has(block.index)) {
      issues.push({ path, message: `index= "${block.index}" collides with a reserved word` });
    } else if (bindingScope.has(block.index)) {
      issues.push({ path, message: `index= "${block.index}" collides with an enclosing {{#each}}'s binding` });
    } else if (block.index === block.as) {
      issues.push({ path, message: `index= "${block.index}" collides with this block's own as=` });
    }
  }

  const pathRoot = block.path.split('.')[0]!;
  if (!RESERVED_SCOPE_ROOTS.has(pathRoot) && !bindingScope.has(pathRoot)) {
    issues.push({
      path,
      message: `{{#each ${block.path}}} root "${pathRoot}" must be a reserved root (sender/recipient/data/system) or an enclosing {{#each}}'s as=`,
    });
  }
};

const bindsAs = (name: string | undefined): name is string =>
  name !== undefined && isValidBindingIdentifier(name) && !RESERVED_BINDING_NAMES.has(name);

const collect = (
  content: string,
  at: string,
  issues: ConditionIssue[],
  bindingScope: BindingChain,
  options: ValidateConditionsOptions,
  eachDepth: number,
): void => {
  let i = 0;
  let blockIdx = 0;

  while (i < content.length) {
    const ifIdx = content.indexOf(IF, i);
    const eachIdx = content.indexOf(EACH, i);
    if (ifIdx === -1 && eachIdx === -1) break;

    const kind: 'if' | 'each' = eachIdx === -1 || (ifIdx !== -1 && ifIdx < eachIdx) ? 'if' : 'each';
    const openIdx = kind === 'if' ? ifIdx : eachIdx;

    if (kind === 'if') {
      const block = parseIfBlock(content, openIdx);
      if (!block) {
        issues.push({ path: `${at}[${blockIdx}]`, message: 'unterminated {{#if}} block — missing {{/if}}' });
        i = openIdx + IF.length;
        blockIdx++;
        continue;
      }

      const elseAt = block.branches.findIndex((b) => b.kind === 'else');
      if (elseAt !== -1 && elseAt !== block.branches.length - 1) {
        issues.push({
          path: `${at}[${blockIdx}]`,
          message: 'branches after {{else}} are unreachable — {{else}} must be last',
        });
      }
      if (block.branches.filter((b) => b.kind === 'else').length > 1) {
        issues.push({ path: `${at}[${blockIdx}]`, message: 'multiple {{else}} branches in one block' });
      }

      block.branches.forEach((branch: Branch, branchIndex) => {
        const path = `${at}[${blockIdx}].${branch.kind}${branchIndex}`;
        if (branch.kind !== 'else') {
          if (branch.ruleError !== undefined) {
            issues.push({ path, message: `invalid rule JSON — ${branch.ruleError}` });
          } else {
            const result = validateRule(branch.rule, { target: 'check' });
            for (const err of result.errors) issues.push({ path: `${path}:${err.path}`, message: err.message });
            if (result.errors.length === 0) validateFieldRoots(branch.rule!, options.lens, bindingScope, path, issues);
          }
        }
        collect(branch.body, path, issues, bindingScope, options, eachDepth);
      });

      i = block.end;
      blockIdx++;
      continue;
    }

    const block = parseEachBlock(content, openIdx);
    if (!block) {
      issues.push({ path: `${at}[${blockIdx}]`, message: 'unterminated {{#each}} block — missing {{/each}}' });
      i = openIdx + EACH.length;
      blockIdx++;
      continue;
    }

    const path = `${at}[${blockIdx}]`;
    if (options.isSubject) {
      issues.push({ path, message: '{{#each}} is not allowed in the subject line — conditionals only' });
    }

    const blockDepth = eachDepth + 1;
    if (blockDepth === EACH_MAX_DEPTH + 1) {
      issues.push({ path, message: `{{#each}} blocks may not nest more than ${EACH_MAX_DEPTH} deep` });
    }

    validateEachAttributes(block, bindingScope, path, issues);

    const elementPath = resolveBindingPath(block.path, bindingScope);

    if (block.filterError !== undefined) {
      issues.push({ path: `${path}.filter`, message: `invalid filter JSON — ${block.filterError}` });
    } else if (block.filter) {
      const result = validateRule(block.filter, { target: 'check' });
      for (const err of result.errors) issues.push({ path: `${path}.filter:${err.path}`, message: err.message });
      if (result.errors.length === 0) {
        const filterScope: BindingChain = new Map(bindingScope);
        if (bindsAs(block.as)) filterScope.set(block.as, elementPath);
        validateFieldRoots(block.filter, options.lens, filterScope, `${path}.filter`, issues);
      }
    }

    const bodyScope: BindingChain = new Map(bindingScope);
    if (bindsAs(block.as)) bodyScope.set(block.as, elementPath);
    if (bindsAs(block.index)) bodyScope.set(block.index, undefined);
    collect(block.body, `${path}.each`, issues, bodyScope, options, blockDepth);

    i = block.end;
    blockIdx++;
  }
};

const collectStraddleIssues = (nodes: Node[], issues: ConditionIssue[]): void => {
  let idx = 0;

  const validateScope = (text: string): void => {
    if (!isStructurallyBalanced(text)) {
      issues.push({
        path: `$straddle[${idx}]`,
        message:
          "an {{#if}}/{{#each}} block is not self-contained — its open and close must not straddle a {{#component}} ref's own body (a `:default` slot, or bare content with no enclosing override slot)",
      });
      idx++;
    }
  };

  const collectScope = (list: Node[]): string => {
    let buffer = '';
    for (const node of list) {
      if (node.type === 'text') {
        buffer += node.value;
      } else if (node.type === 'slot') {
        buffer += collectScope(node.children);
      } else {
        const overrides: Node[] = [];
        const body: Node[] = [];
        for (const child of node.children) {
          if (child.type === 'slot' && !child.isDefault) overrides.push(child);
          else body.push(child);
        }
        buffer += collectScope(overrides);
        validateScope(collectScope(body));
      }
    }
    return buffer;
  };

  validateScope(collectScope(nodes));
};

export const validateConditions = (content: string, options: ValidateConditionsOptions = {}): ConditionIssue[] => {
  const issues: ConditionIssue[] = [];
  collect(content, '$', issues, new Map(), options, 0);

  const nodes = parseBlocks(content);
  if (!(nodes.length === 1 && nodes[0]?.type === 'text')) collectStraddleIssues(nodes, issues);

  return issues;
};

export class ConditionValidationError extends Error {
  readonly issues: ConditionIssue[];

  constructor(issues: ConditionIssue[]) {
    super(`Invalid conditional rule(s):\n${issues.map((x) => `  ${x.path}: ${x.message}`).join('\n')}`);
    this.name = 'ConditionValidationError';
    this.issues = issues;
  }
}

export const assertValidConditions = (content: string, options: ValidateConditionsOptions = {}): void => {
  const issues = validateConditions(content, options);
  if (issues.length > 0) throw new ConditionValidationError(issues);
};
