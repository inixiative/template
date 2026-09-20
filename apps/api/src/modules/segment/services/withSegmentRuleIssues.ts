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
import { omit } from 'lodash-es';
import {
  type SegmentRuleState,
  type SegmentWithEdges,
  segmentRuleIssuesFromEdges,
  segmentRuleStates,
} from '#/modules/segment/services/segmentRuleHealth';

export type SegmentWithRuleIssues = Segment & { ruleIssues: RuleIssue[] };

export const withSegmentsRuleIssues = async (
  segments: SegmentWithEdges[],
  db: Db = defaultDb,
): Promise<SegmentWithRuleIssues[]> => {
  const direct = new Map(segments.map((segment) => [segment.id, segmentRuleIssuesFromEdges(segment)]));
  const closing = segments.filter((segment) => direct.get(segment.id) === null);
  const states: Map<string, SegmentRuleState> = closing.length ? await segmentRuleStates(closing, db) : new Map();
  return segments.map((segment) => ({
    ...omit(segment, 'ruleReferences'),
    ruleIssues: direct.get(segment.id) ?? states.get(segment.id)?.issues ?? [],
  }));
};

export const withSegmentRuleIssues = async (
  segment: SegmentWithEdges,
  db: Db = defaultDb,
): Promise<SegmentWithRuleIssues> => (await withSegmentsRuleIssues([segment], db))[0]!;

export const soundSegments = async (
  segments: SegmentWithEdges[],
  db: Db = defaultDb,
): Promise<SegmentWithRuleIssues[]> =>
  (await withSegmentsRuleIssues(segments, db)).filter((segment) => !segment.ruleIssues.length);
