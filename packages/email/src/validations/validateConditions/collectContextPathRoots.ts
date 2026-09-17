/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses primitive:shared
 */
import type { Condition } from '@inixiative/json-rules';
import { walkConditionTree } from '@template/email/rules/walkConditionTree';
import type { ConditionNode } from '@template/email/validations/validateConditions/types';

export const collectContextPathRoots = (cond: Condition | undefined, out: Set<string>): void => {
  walkConditionTree(cond, out, (leaf, roots) => {
    const node = leaf as ConditionNode;
    if (typeof node.path === 'string' && node.path && !node.path.startsWith('$.')) roots.add(node.path.split('.')[0]!);
    return [
      { condition: node.condition as Condition | undefined, context: roots },
      { condition: node.filter as Condition | undefined, context: roots },
    ];
  });
};
