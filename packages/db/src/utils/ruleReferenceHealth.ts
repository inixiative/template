/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import { resolveFalsePolymorphismRef } from '@template/db/registries/falsePolymorphism';
import type { ModelName } from '@template/db/utils/modelNames';
import { type RuleReference, referenceKey } from '@template/shared/rules';

/** The shape a rule-reference edge has to arrive in for its target to be readable. No relations. */
export type RuleReferenceRow = {
  targetModel: string;
  targetId: string;
  targetDeletedAt?: Date | null;
} & Record<string, unknown>;

export type RuleReferenceTarget = RuleReference & {
  key: string;
  state: 'existing' | 'deleted' | 'purged';
};

const purged = (edge: RuleReferenceRow): boolean => {
  const column = resolveFalsePolymorphismRef({
    model: 'RuleReference',
    axis: 'targetModel',
    value: edge.targetModel as ModelName,
  });
  return !column || edge[column] == null;
};

/**
 * Each edge's target and its state, read from the edge rows alone: a soft delete is the copied
 * `targetDeletedAt`, a purge is a null typed FK beside the `targetId` that still names the row.
 */
export const ruleReferenceTargets = (edges: RuleReferenceRow[]): RuleReferenceTarget[] =>
  edges.map((edge) => ({
    model: edge.targetModel,
    id: edge.targetId,
    key: referenceKey({ model: edge.targetModel, id: edge.targetId }),
    state: edge.targetDeletedAt != null ? 'deleted' : purged(edge) ? 'purged' : 'existing',
  }));
