/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
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

export const withSegmentsRuleIssues = async (segments: SegmentWithEdges[]): Promise<SegmentWithRuleIssues[]> => {
  const direct = new Map(segments.map((segment) => [segment.id, segmentRuleIssuesFromEdges(segment)]));
  const closing = segments.filter((segment) => direct.get(segment.id) === null);
  const states: Map<string, SegmentRuleState> = closing.length ? await segmentRuleStates(closing) : new Map();
  return segments.map((segment) => ({
    ...omit(segment, 'ruleReferences'),
    ruleIssues: direct.get(segment.id) ?? states.get(segment.id)?.issues ?? [],
  }));
};

export const withSegmentRuleIssues = async (segment: SegmentWithEdges): Promise<SegmentWithRuleIssues> =>
  (await withSegmentsRuleIssues([segment]))[0]!;

export const soundSegments = async (segments: SegmentWithEdges[]): Promise<SegmentWithRuleIssues[]> =>
  (await withSegmentsRuleIssues(segments)).filter((segment) => !segment.ruleIssues.length);
