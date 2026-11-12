/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import { db, type RuleReferenceRow } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import type { RuleReferenceTargetModel } from '@template/db/generated/client/enums';
import type { RuleIssue } from '@template/shared/rules';
import { groupBy, omit } from 'lodash-es';
import {
  type SegmentRuleState,
  type SegmentWithEdges,
  segmentRuleIssuesFromEdges,
  segmentRuleStates,
} from '#/modules/segment/services/segmentRuleHealth';

export type SegmentRuleReference = {
  targetModel: RuleReferenceTargetModel;
  targetId: string;
  targetDeletedAt: Date | null;
};

export type SegmentWithRuleIssues = Segment & { ruleIssues: RuleIssue[] };

export type SegmentWithRuleHealth = SegmentWithRuleIssues & {
  ruleReferences: SegmentRuleReference[];
};

const ruleIssuesOf = async (segments: SegmentWithEdges[]): Promise<SegmentWithRuleIssues[]> => {
  const direct = new Map(
    segments.map((segment) => [segment.id, segmentRuleIssuesFromEdges(segment)]),
  );
  const closing = segments.filter((segment) => direct.get(segment.id) === null);
  const states: Map<string, SegmentRuleState> = closing.length
    ? await segmentRuleStates(closing)
    : new Map();
  return segments.map((segment) => ({
    ...omit(segment, 'sourceRuleReferences'),
    ruleIssues: direct.get(segment.id) ?? states.get(segment.id)?.issues ?? [],
  }));
};

const edgesOf = async (segments: SegmentWithEdges[]): Promise<Map<string, RuleReferenceRow[]>> => {
  const edges = new Map(
    segments.flatMap((segment) =>
      segment.sourceRuleReferences ? [[segment.id, segment.sourceRuleReferences]] : [],
    ),
  );
  const unloaded = segments.filter((segment) => !edges.has(segment.id)).map(({ id }) => id);
  if (unloaded.length) {
    const fetched = groupBy(
      await db.ruleReference.findMany({
        where: { sourceModel: 'Segment', sourceId: { in: unloaded } },
        orderBy: { createdAt: 'asc' },
      }),
      'sourceId',
    );
    for (const id of unloaded) edges.set(id, fetched[id] ?? []);
  }
  return edges;
};

const ruleReferencesOf = async (
  segments: SegmentWithEdges[],
): Promise<Map<string, SegmentRuleReference[]>> =>
  new Map(
    [...(await edgesOf(segments))].map(([id, rows]) => [
      id,
      rows.map((edge) => ({
        targetModel: edge.targetModel as RuleReferenceTargetModel,
        targetId: edge.targetId,
        targetDeletedAt: edge.targetDeletedAt ?? null,
      })),
    ]),
  );

export const withSegmentsRuleIssues = async (
  segments: SegmentWithEdges[],
): Promise<SegmentWithRuleHealth[]> => {
  const withIssues = await ruleIssuesOf(segments);
  const references = await ruleReferencesOf(segments);
  return withIssues.map((segment) => ({
    ...segment,
    ruleReferences: references.get(segment.id) ?? [],
  }));
};

export const withSegmentRuleIssues = async (
  segment: SegmentWithEdges,
): Promise<SegmentWithRuleHealth> => (await withSegmentsRuleIssues([segment]))[0]!;

export const soundSegments = async (
  segments: SegmentWithEdges[],
): Promise<SegmentWithRuleIssues[]> =>
  (await ruleIssuesOf(segments)).filter((segment) => !segment.ruleIssues.length);
