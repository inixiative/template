/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses primitive:shared
 */
import type { ConditionIssue } from '@template/email/errors/ConditionValidationError';
import { isStructurallyBalanced } from '@template/email/render/conditionParser';
import type { Node } from '@template/email/render/nodes';

export const collectStraddleIssues = (nodes: Node[], issues: ConditionIssue[]): void => {
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
