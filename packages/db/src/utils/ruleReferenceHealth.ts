/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import { resolveFalsePolymorphismRef } from '@template/db/registries/falsePolymorphism';
import type { ModelName } from '@template/db/utils/modelNames';

/** The shape a rule-reference edge has to arrive in for its health to be readable. No relations. */
export type RuleReferenceRow = {
  referencedModel: string;
  referencedId: string;
  referencedDeletedAt?: Date | null;
} & Record<string, unknown>;

export type RuleReferenceIssue = {
  key: string;
  referencedModel: string;
  referencedId: string;
  reason: 'deleted' | 'purged';
};

export const ruleReferenceKey = (reference: { model: string; id: string }): string =>
  `${reference.model}|${reference.id}`;

const purged = (edge: RuleReferenceRow): boolean => {
  const column = resolveFalsePolymorphismRef({
    model: 'RuleReference',
    axis: 'referencedModel',
    value: edge.referencedModel as ModelName,
  });
  // why: an unregistered referencedModel cannot be checked, and reading it as healthy is the
  // why: vacuous-`none` outcome this table exists to prevent - so it counts as gone.
  return !column || edge[column] == null;
};

/**
 * Which of these edges no longer resolve, read from the edge rows alone.
 *
 * Two signals, because a target leaves in two ways: soft delete is copied onto the edge as
 * `referencedDeletedAt`, and a purge nulls the typed FK while `referencedId` keeps the name.
 */
export const ruleReferenceIssues = (edges: RuleReferenceRow[]): RuleReferenceIssue[] =>
  edges.flatMap((edge) => {
    const reason = edge.referencedDeletedAt != null ? 'deleted' : purged(edge) ? 'purged' : null;
    if (!reason) return [];
    const { referencedModel, referencedId } = edge;
    return [
      { key: ruleReferenceKey({ model: referencedModel, id: referencedId }), referencedModel, referencedId, reason },
    ];
  });

/** The reference keys these edges name that are still usable — absence is the answer, so callers fail closed. */
export const liveRuleReferenceKeys = (edges: RuleReferenceRow[]): Set<string> => {
  const broken = new Set(ruleReferenceIssues(edges).map((issue) => issue.key));
  const live = new Set<string>();
  for (const edge of edges) {
    const key = ruleReferenceKey({ model: edge.referencedModel, id: edge.referencedId });
    if (!broken.has(key)) live.add(key);
  }
  return live;
};
