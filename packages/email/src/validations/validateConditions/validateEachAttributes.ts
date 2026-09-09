/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses primitive:shared
 */
import type { ConditionIssue } from '@template/email/errors/ConditionValidationError';
import {
  isValidBindingIdentifier,
  RESERVED_BINDING_NAMES,
  RESERVED_SCOPE_ROOTS,
} from '@template/email/render/conditionParser';
import type { BindingChain } from '@template/email/rules/resolveBindingPath';

export const validateEachAttributes = (
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
