/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma, primitive:shared
 */
import type { Condition } from '@inixiative/json-rules';
import { db, type RuleReferenceRow, ruleHealthFromEdges } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import { type RuleHealth, type RuleIssue, referenceKey, ruleIssues } from '@template/shared/rules';
import { groupBy, keyBy, uniqBy } from 'lodash-es';
import { customerRefLens, ownedSegments } from '#/modules/customerRef/lib/customerRefLens';
import { segmentOwnerId } from '#/modules/segment/lib/segmentOwner';

export type SegmentRuleState = { segment: Segment; health: RuleHealth; issues: RuleIssue[] };

export type SegmentWithEdges = Segment & { ruleReferences?: RuleReferenceRow[] };

const segmentKey = (id: string): string => referenceKey({ model: 'Segment', id });

const ownerKey = (segment: Segment): string => `${segment.ownerModel}:${segmentOwnerId(segment)}`;

const degradedReferenceDetail = (issue: RuleIssue, degraded: ReadonlySet<string>): RuleIssue =>
  issue.kind === 'reference' && degraded.has(referenceKey(issue.reference))
    ? { ...issue, detail: `rule names a ${issue.reference.model} whose own rule is degraded: ${issue.reference.id}` }
    : issue;

const ownerSegments = (sample: Segment): Promise<Segment[]> => ownedSegments(sample.ownerModel, segmentOwnerId(sample));

const edgesFor = async (segmentIds: string[]): Promise<Record<string, RuleReferenceRow[]>> =>
  groupBy(
    (await db.ruleReference.findMany({ where: { segmentId: { in: segmentIds } } })) as (RuleReferenceRow & {
      segmentId: string;
    })[],
    'segmentId',
  );

const closeOverOwner = (
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

    const base = ruleHealthFromEdges(customerRefLens, segment.conditions as Condition, edges[segment.id] ?? []);
    const { references, live } = base;
    const degraded = new Set<string>();
    for (const reference of references) {
      if (reference.model !== 'Segment' || !live.has(referenceKey(reference))) continue;
      const named = byId[reference.id];
      if (!named || visiting.has(named.id)) continue;
      if (stateOf(named).issues.length) degraded.add(segmentKey(named.id));
    }

    const health: RuleHealth = { ...base, live: new Set([...live].filter((key) => !degraded.has(key))) };
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

export const segmentRuleStates = async (segments: Segment[]): Promise<Map<string, SegmentRuleState>> => {
  const states = new Map<string, SegmentRuleState>();
  for (const sample of uniqBy(segments, ownerKey)) {
    const owned = uniqBy(
      [...(await ownerSegments(sample)), ...segments.filter((s) => ownerKey(s) === ownerKey(sample))],
      'id',
    );
    const edges = await edgesFor(owned.map((segment) => segment.id));
    for (const [id, state] of closeOverOwner(owned, edges)) states.set(id, state);
  }
  return states;
};

export const segmentRuleState = async (segment: Segment): Promise<SegmentRuleState> =>
  (await segmentRuleStates([segment])).get(segment.id)!;

/** Issues read off the row's own edges; null when a live segment reference means the owner closure decides. */
export const segmentRuleIssuesFromEdges = (segment: SegmentWithEdges): RuleIssue[] | null => {
  if (!segment.ruleReferences) return null;
  const health = ruleHealthFromEdges(customerRefLens, segment.conditions as Condition, segment.ruleReferences);
  if (health.references.some((reference) => reference.model === 'Segment' && health.live.has(referenceKey(reference))))
    return null;
  return ruleIssues(health);
};
