/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma, primitive:shared
 */
import type { Condition } from '@inixiative/json-rules';
import { db, type RuleReferenceRow, ruleReferences, ruleReferenceTargets } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import { type RuleHealth, type RuleIssue, referenceKey, ruleIssues } from '@template/shared/rules';
import { groupBy, keyBy } from 'lodash-es';
import { customerRefLens } from '#/modules/customerRef/lib/customerRefLens';

export type SegmentRuleState = { segment: Segment; health: RuleHealth; issues: RuleIssue[] };

export type SegmentWithEdges = Segment & { sourceRuleReferences?: RuleReferenceRow[] };

const healthOf = (
  segment: Segment,
  edges: RuleReferenceRow[],
): RuleHealth & {
  existingTargets: Set<string>;
} => ({
  lens: customerRefLens,
  rule: segment.conditions as Condition,
  references: ruleReferences(customerRefLens, segment.conditions as Condition),
  existingTargets: new Set(
    ruleReferenceTargets(edges)
      .filter((target) => target.state === 'existing')
      .map((target) => target.key),
  ),
});

const segmentKey = (id: string): string => referenceKey({ model: 'Segment', id });

const degradedReferenceDetail = (issue: RuleIssue, degraded: ReadonlySet<string>): RuleIssue =>
  issue.kind === 'reference' && degraded.has(referenceKey(issue.reference))
    ? {
        ...issue,
        detail: `rule names a ${issue.reference.model} whose own rule is degraded: ${issue.reference.id}`,
      }
    : issue;

const edgesFor = async (segmentIds: string[]): Promise<Record<string, RuleReferenceRow[]>> =>
  groupBy(
    (await db.ruleReference.findMany({
      where: { sourceSegmentId: { in: segmentIds } },
    })) as (RuleReferenceRow & {
      sourceSegmentId: string;
    })[],
    'sourceSegmentId',
  );

const closeOverEdges = (
  segments: Segment[],
  edges: Record<string, RuleReferenceRow[]>,
): Map<string, SegmentRuleState> => {
  const byId = keyBy(segments, 'id');
  const states = new Map<string, SegmentRuleState>();
  const visiting = new Set<string>();

  const stateOf = (segment: Segment): SegmentRuleState => {
    const known = states.get(segment.id);
    if (known) return known;
    visiting.add(segment.id);

    const base = healthOf(segment, edges[segment.id] ?? []);
    const { references, existingTargets } = base;
    const degraded = new Set<string>();
    for (const reference of references) {
      if (reference.model !== 'Segment' || !existingTargets.has(referenceKey(reference))) continue;
      const referencedSegment = byId[reference.id];
      if (!referencedSegment || visiting.has(referencedSegment.id)) continue;
      if (stateOf(referencedSegment).issues.length) degraded.add(segmentKey(referencedSegment.id));
    }

    const health: RuleHealth = {
      ...base,
      existingTargets: new Set([...existingTargets].filter((key) => !degraded.has(key))),
    };
    const state = {
      segment,
      health,
      issues: ruleIssues(health).map((issue) => degradedReferenceDetail(issue, degraded)),
    };
    visiting.delete(segment.id);
    states.set(segment.id, state);
    return state;
  };

  for (const segment of segments) stateOf(segment);
  return states;
};

const referencedSegmentIds = (edges: RuleReferenceRow[]): string[] =>
  edges.flatMap((edge) =>
    edge.targetModel === 'Segment' && edge.targetSegmentId != null && edge.targetDeletedAt == null
      ? [edge.targetSegmentId as string]
      : [],
  );

/** Each segment's rule state, closed over the segments its edges reference, transitively. */
export const segmentRuleStates = async (
  segments: Segment[],
): Promise<Map<string, SegmentRuleState>> => {
  const reached = new Map(segments.map((segment) => [segment.id, segment]));
  const edges: Record<string, RuleReferenceRow[]> = {};
  let frontier = [...reached.keys()];
  while (frontier.length) {
    Object.assign(edges, await edgesFor(frontier));
    const next = [
      ...new Set(frontier.flatMap((id) => referencedSegmentIds(edges[id] ?? []))),
    ].filter((id) => !reached.has(id));
    for (const segment of next.length
      ? await db.segment.findMany({ where: { id: { in: next } } })
      : [])
      reached.set(segment.id, segment);
    frontier = next.filter((id) => reached.has(id));
  }
  return closeOverEdges([...reached.values()], edges);
};

export const segmentRuleState = async (segment: Segment): Promise<SegmentRuleState> =>
  (await segmentRuleStates([segment])).get(segment.id)!;

/** Issues read off the row's own edges; null when an existing segment reference means the edge closure decides. */
export const segmentRuleIssuesFromEdges = (segment: SegmentWithEdges): RuleIssue[] | null => {
  if (!segment.sourceRuleReferences) return null;
  const health = healthOf(segment, segment.sourceRuleReferences);
  if (
    health.references.some(
      (reference) =>
        reference.model === 'Segment' && health.existingTargets.has(referenceKey(reference)),
    )
  )
    return null;
  return ruleIssues(health);
};
