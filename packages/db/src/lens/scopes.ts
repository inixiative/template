/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import { type Condition, Operator } from '@inixiative/json-rules';
import { polymorphicIs } from '@template/db/registries/polymorphicIs';
import type { ModelName } from '@template/db/utils/modelNames';

export const live: Condition = { field: 'deletedAt', operator: Operator.notExists };

export const platformOrBound = (model: ModelName, axis: string): Condition => ({
  all: [
    live,
    {
      any: [
        { field: axis, operator: Operator.equals, value: 'platform' },
        polymorphicIs(model, axis),
      ],
    },
  ],
});

export const boundAndLive = (model: ModelName, axis: string): Condition => ({
  all: [polymorphicIs(model, axis), live],
});

export const through = (relation: string, condition: Condition): Condition => {
  if (typeof condition !== 'object' || condition === null) return condition;
  const node = condition as Record<string, unknown>;
  if (Array.isArray(node.all))
    return { all: (node.all as Condition[]).map((c) => through(relation, c)) };
  if (Array.isArray(node.any))
    return { any: (node.any as Condition[]).map((c) => through(relation, c)) };
  if ('if' in node) {
    const out: Record<string, unknown> = { ...node };
    for (const key of ['if', 'then', 'else'])
      if (node[key] !== undefined) out[key] = through(relation, node[key] as Condition);
    return out as Condition;
  }
  return typeof node.field === 'string'
    ? ({ ...node, field: `${relation}.${node.field}` } as Condition)
    : condition;
};
