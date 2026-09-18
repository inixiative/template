/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import type { Db } from '@template/db';
import { db as defaultDb } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import type { RuleIssue } from '@template/shared/rules';
import { segmentRuleState, segmentRuleStates } from '#/modules/segment/services/segmentRuleHealth';

export type SegmentWithRuleIssues = Segment & { ruleIssues: RuleIssue[] };

export const withSegmentRuleIssues = async (segment: Segment, db: Db = defaultDb): Promise<SegmentWithRuleIssues> => ({
  ...segment,
  ruleIssues: (await segmentRuleState(segment, db)).issues,
});

export const withSegmentsRuleIssues = async (
  segments: Segment[],
  db: Db = defaultDb,
): Promise<SegmentWithRuleIssues[]> => {
  if (!segments.length) return [];
  const states = await segmentRuleStates(segments, db);
  return segments.map((segment) => ({ ...segment, ruleIssues: states.get(segment.id)?.issues ?? [] }));
};

export const soundSegments = async (segments: Segment[], db: Db = defaultDb): Promise<SegmentWithRuleIssues[]> =>
  (await withSegmentsRuleIssues(segments, db)).filter((segment) => !segment.ruleIssues.length);
