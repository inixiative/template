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
  for (const key of ['all', 'any'])
    if (Array.isArray(node[key]))
      return {
        ...node,
        [key]: (node[key] as Condition[]).map((child) => through(relation, child)),
      } as Condition;
  if ('if' in node) {
    const out: Record<string, unknown> = { ...node };
    for (const key of ['if', 'then', 'else'])
      if (node[key] !== undefined) out[key] = through(relation, node[key] as Condition);
    return out as Condition;
  }
  if (node.path !== undefined)
    throw new Error(`through('${relation}'): a clamp comparing against a path cannot be re-rooted`);
  return typeof node.field === 'string'
    ? ({ ...node, field: `${relation}.${node.field}` } as Condition)
    : condition;
};
