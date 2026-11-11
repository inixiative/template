/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses primitive:shared
 */
import { validateRule } from '@inixiative/json-rules';
import type { ConditionIssue } from '@template/email/errors/ConditionValidationError';
import { visitTemplateBlocks } from '@template/email/render/conditionParser';
import { EACH_MAX_DEPTH } from '@template/email/render/limits';
import { type BindingChain, resolveBindingPath } from '@template/email/rules/resolveBindingPath';
import { bindsAs } from '@template/email/validations/validateConditions/bindsAs';
import type { ValidateConditionsOptions } from '@template/email/validations/validateConditions/types';
import { validateEachAttributes } from '@template/email/validations/validateConditions/validateEachAttributes';
import { validateFieldRoots } from '@template/email/validations/validateConditions/validateFieldRoots';

type ConditionScope = { at: string; bindingScope: BindingChain; eachDepth: number };

export const collect = (
  content: string,
  at: string,
  issues: ConditionIssue[],
  bindingScope: BindingChain,
  options: ValidateConditionsOptions,
  eachDepth: number,
): void =>
  visitTemplateBlocks<ConditionScope>(
    content,
    {
      unterminated: (kind, { blockIndex }, { state }) => {
        issues.push({
          path: `${state.at}[${blockIndex}]`,
          message:
            kind === 'if'
              ? 'unterminated {{#if}} block — missing {{/if}}'
              : 'unterminated {{#each}} block — missing {{/each}}',
        });
      },
      ifBlock: (block, { blockIndex }, { state }) => {
        const elseAt = block.branches.findIndex((b) => b.kind === 'else');
        if (elseAt !== -1 && elseAt !== block.branches.length - 1) {
          issues.push({
            path: `${state.at}[${blockIndex}]`,
            message: 'branches after {{else}} are unreachable — {{else}} must be last',
          });
        }
        if (block.branches.filter((b) => b.kind === 'else').length > 1) {
          issues.push({
            path: `${state.at}[${blockIndex}]`,
            message: 'multiple {{else}} branches in one block',
          });
        }
      },
      branch: (branch, branchIndex, { blockIndex }, { state }) => {
        const path = `${state.at}[${blockIndex}].${branch.kind}${branchIndex}`;
        if (branch.kind !== 'else') {
          if (branch.ruleError !== undefined) {
            issues.push({ path, message: `invalid rule JSON — ${branch.ruleError}` });
          } else {
            const result = validateRule(branch.rule, { target: 'check' });
            for (const err of result.errors)
              issues.push({ path: `${path}:${err.path}`, message: err.message });
            if (result.errors.length === 0)
              validateFieldRoots(branch.rule!, options.lens, state.bindingScope, path, issues);
          }
        }
        return { ...state, at: path };
      },
      loop: (block, _loop, { blockIndex }, { state }) => {
        const path = `${state.at}[${blockIndex}]`;
        if (options.isSubject) {
          issues.push({
            path,
            message: '{{#each}} is not allowed in the subject line — conditionals only',
          });
        }

        const blockDepth = state.eachDepth + 1;
        if (blockDepth === EACH_MAX_DEPTH + 1) {
          issues.push({
            path,
            message: `{{#each}} blocks may not nest more than ${EACH_MAX_DEPTH} deep`,
          });
        }

        validateEachAttributes(block, state.bindingScope, path, issues);

        const elementPath = resolveBindingPath(block.path, state.bindingScope);

        if (block.filterError !== undefined) {
          issues.push({
            path: `${path}.filter`,
            message: `invalid filter JSON — ${block.filterError}`,
          });
        } else if (block.filter) {
          const result = validateRule(block.filter, { target: 'check' });
          for (const err of result.errors)
            issues.push({ path: `${path}.filter:${err.path}`, message: err.message });
          if (result.errors.length === 0) {
            const filterScope: BindingChain = new Map(state.bindingScope);
            if (bindsAs(block.as)) filterScope.set(block.as, elementPath);
            validateFieldRoots(block.filter, options.lens, filterScope, `${path}.filter`, issues);
          }
        }

        const bodyScope: BindingChain = new Map(state.bindingScope);
        if (bindsAs(block.as)) bodyScope.set(block.as, elementPath);
        if (bindsAs(block.index)) bodyScope.set(block.index, undefined);
        return { at: `${path}.each`, bindingScope: bodyScope, eachDepth: blockDepth };
      },
    },
    { bindings: new Map(), state: { at, bindingScope, eachDepth } },
  );
