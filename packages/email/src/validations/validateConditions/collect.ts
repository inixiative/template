/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses primitive:shared
 */
import { validateRule } from '@inixiative/json-rules';
import type { ConditionIssue } from '@template/email/errors/ConditionValidationError';
import { type Branch, EACH, IF, parseEachBlock, parseIfBlock } from '@template/email/render/conditionParser';
import { EACH_MAX_DEPTH } from '@template/email/render/limits';
import { type BindingChain, resolveBindingPath } from '@template/email/rules/resolveBindingPath';
import { bindsAs } from '@template/email/validations/validateConditions/bindsAs';
import type { ValidateConditionsOptions } from '@template/email/validations/validateConditions/types';
import { validateEachAttributes } from '@template/email/validations/validateConditions/validateEachAttributes';
import { validateFieldRoots } from '@template/email/validations/validateConditions/validateFieldRoots';

export const collect = (
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
