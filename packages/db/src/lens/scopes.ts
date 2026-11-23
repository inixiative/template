/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { type Condition, Operator } from '@inixiative/json-rules';
import { conditionPolymorphicAxisPointsAtBoundRow } from '@template/db/registries/polymorphicAxisPointsAt';
import type { ModelName } from '@template/db/utils/modelNames';
import { notDeleted } from '@template/shared/rules';

export const platformOrPointsAtBoundRow = (model: ModelName, axis: string): Condition => ({
  all: [
    notDeleted,
    {
      any: [
        { field: axis, operator: Operator.equals, value: 'platform' },
        conditionPolymorphicAxisPointsAtBoundRow(model, axis),
      ],
    },
  ],
});

export const pointsAtBoundRowAndIsNotDeleted = (model: ModelName, axis: string): Condition => ({
  all: [conditionPolymorphicAxisPointsAtBoundRow(model, axis), notDeleted],
});

export const rerootConditionUnderRelation = (relation: string, condition: Condition): Condition => {
  if (typeof condition !== 'object' || condition === null) return condition;
  const node = condition as Record<string, unknown>;
  for (const key of ['all', 'any'])
    if (Array.isArray(node[key]))
      return {
        ...node,
        [key]: (node[key] as Condition[]).map((child) =>
          rerootConditionUnderRelation(relation, child),
        ),
      } as Condition;
  if ('if' in node) {
    const out: Record<string, unknown> = { ...node };
    for (const key of ['if', 'then', 'else'])
      if (node[key] !== undefined)
        out[key] = rerootConditionUnderRelation(relation, node[key] as Condition);
    return out as Condition;
  }
  if (node.path !== undefined)
    throw new Error(
      `rerootConditionUnderRelation('${relation}'): a clamp comparing against a path cannot be re-rooted`,
    );
  return typeof node.field === 'string'
    ? ({ ...node, field: `${relation}.${node.field}` } as Condition)
    : condition;
};
