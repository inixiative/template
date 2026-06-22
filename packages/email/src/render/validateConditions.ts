/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses none
 */
import { validateRule } from '@inixiative/json-rules';
import { type Branch, IF, parseIfBlock } from '@template/email/render/conditionParser';

export type ConditionIssue = { path: string; message: string };

// Structurally validate every embedded `{{#if rule=…}}` / `{{else if rule=…}}` Condition (parseable
// + valid json-rules grammar for the `check` target) and the block balance. Recurses into branches.
// Lens-awareness (is the field actually exposed to this email?) is intentionally out of scope until
// the builder lands — this is the structural floor we can enforce today.
const collect = (content: string, at: string, issues: ConditionIssue[]): void => {
  let i = 0;
  let blockIdx = 0;
  while (i < content.length) {
    const openIdx = content.indexOf(IF, i);
    if (openIdx === -1) break;

    const block = parseIfBlock(content, openIdx);
    if (!block) {
      issues.push({ path: `${at}[${blockIdx}]`, message: 'unterminated {{#if}} block — missing {{/if}}' });
      i = openIdx + IF.length; // keep validating later blocks instead of bailing
      blockIdx++;
      continue;
    }

    // Branch ordering: {{else}} must be last and unique — anything after a bare {{else}} is dead
    // code the renderer never reaches.
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

    block.branches.forEach((branch: Branch, bi) => {
      const path = `${at}[${blockIdx}].${branch.kind}${bi}`;
      if (branch.kind !== 'else') {
        if (branch.ruleError !== undefined) {
          issues.push({ path, message: `invalid rule JSON — ${branch.ruleError}` });
        } else {
          const result = validateRule(branch.rule, { target: 'check' });
          for (const err of result.errors) issues.push({ path: `${path}:${err.path}`, message: err.message });
        }
      }
      collect(branch.body, path, issues); // nested blocks
    });

    i = block.end;
    blockIdx++;
  }
};

export const validateConditions = (content: string): ConditionIssue[] => {
  const issues: ConditionIssue[] = [];
  collect(content, '$', issues);
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

export const assertValidConditions = (content: string): void => {
  const issues = validateConditions(content);
  if (issues.length > 0) throw new ConditionValidationError(issues);
};
