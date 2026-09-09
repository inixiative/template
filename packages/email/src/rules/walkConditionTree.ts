/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import type { Condition } from '@inixiative/json-rules';

export type ConditionTreeChild<Context> = {
  condition: Condition | undefined;
  context: Context;
};

type ConditionTreeVisitor<Context> = (
  condition: Condition,
  context: Context,
) => ConditionTreeChild<Context>[] | undefined;

export const walkConditionTree = <Context>(
  condition: Condition | undefined,
  context: Context,
  visit: ConditionTreeVisitor<Context>,
): void => {
  if (condition == null || typeof condition === 'boolean') return;
  const node = condition as Record<string, unknown>;

  if (Array.isArray(node.all)) {
    for (const child of node.all as Condition[]) walkConditionTree(child, context, visit);
    return;
  }
  if (Array.isArray(node.any)) {
    for (const child of node.any as Condition[]) walkConditionTree(child, context, visit);
    return;
  }
  if ('if' in node) {
    walkConditionTree(node.if as Condition, context, visit);
    walkConditionTree(node.then as Condition, context, visit);
    walkConditionTree(node.else as Condition | undefined, context, visit);
    return;
  }

  for (const child of visit(condition, context) ?? []) {
    walkConditionTree(child.condition, child.context, visit);
  }
};
