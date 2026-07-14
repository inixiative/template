/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses none
 */
import { validateRule } from '@inixiative/json-rules';
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
import { type Node, parseBlocks } from '@template/email/render/parseBlocks';

export type ConditionIssue = { path: string; message: string };

export type ValidateConditionsOptions = {
  isSubject?: boolean;
};

// Lens-awareness (is the field actually exposed to this email?) is intentionally out of scope until
// the builder lands — this is the structural floor we can enforce today.
const validateEachAttributes = (
  block: { as?: string; asMissing?: boolean; index?: string; path: string; attributeErrors?: string[] },
  bindingScope: ReadonlySet<string>,
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

const collect = (
  content: string,
  at: string,
  issues: ConditionIssue[],
  bindingScope: ReadonlySet<string>,
  options: ValidateConditionsOptions,
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
          }
        }
        collect(branch.body, path, issues, bindingScope, options);
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

    validateEachAttributes(block, bindingScope, path, issues);

    if (block.filterError !== undefined) {
      issues.push({ path: `${path}.filter`, message: `invalid filter JSON — ${block.filterError}` });
    } else if (block.filter) {
      const result = validateRule(block.filter, { target: 'check' });
      for (const err of result.errors) issues.push({ path: `${path}.filter:${err.path}`, message: err.message });
    }

    const bodyScope = new Set(bindingScope);
    if (block.as && isValidBindingIdentifier(block.as) && !RESERVED_BINDING_NAMES.has(block.as))
      bodyScope.add(block.as);
    if (block.index && isValidBindingIdentifier(block.index) && !RESERVED_BINDING_NAMES.has(block.index)) {
      bodyScope.add(block.index);
    }
    collect(block.body, `${path}.each`, issues, bodyScope, options);

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
  collect(content, '$', issues, new Set(), options);

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
