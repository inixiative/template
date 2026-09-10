/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import { type Db, db as defaultDb, type RuleReferenceRow } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import type { RuleIssue } from '@template/shared/rules';
import { segmentRuleIssues } from '#/modules/segment/services/segmentRuleHealth';

export type SegmentWithRuleIssues = Segment & { ruleIssues: RuleIssue[] };

export const withSegmentRuleIssues = async (segment: Segment, db: Db = defaultDb): Promise<SegmentWithRuleIssues> => {
  const edges = (await db.ruleReference.findMany({ where: { segmentId: segment.id } })) as RuleReferenceRow[];
  return { ...segment, ruleIssues: segmentRuleIssues(segment, edges) };
};

export const withSegmentsRuleIssues = async (
  segments: Segment[],
  db: Db = defaultDb,
): Promise<SegmentWithRuleIssues[]> => {
  if (!segments.length) return [];
  const edges = (await db.ruleReference.findMany({
    where: { segmentId: { in: segments.map((segment) => segment.id) } },
  })) as (RuleReferenceRow & { segmentId: string })[];
  const bySegment = new Map<string, RuleReferenceRow[]>();
  for (const edge of edges) bySegment.set(edge.segmentId, [...(bySegment.get(edge.segmentId) ?? []), edge]);
  return segments.map((segment) => ({
    ...segment,
    ruleIssues: segmentRuleIssues(segment, bySegment.get(segment.id) ?? []),
  }));
};
