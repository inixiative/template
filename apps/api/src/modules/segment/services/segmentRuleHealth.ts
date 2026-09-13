/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma, primitive:shared
 */
import type { Condition } from '@inixiative/json-rules';
import { type Db, db as defaultDb, liveRuleReferenceKeys, type RuleReferenceRow } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import { type RuleHealth, type RuleIssue, ruleIssues } from '@template/shared/rules';
import { segmentLensFor } from '#/modules/segment/lib/segmentLens';
import { segmentReferences } from '#/modules/segment/services/segmentReferences';

export const segmentRuleEdges = (segmentId: string, db: Db = defaultDb): Promise<RuleReferenceRow[]> =>
  db.ruleReference.findMany({ where: { segmentId } }) as Promise<RuleReferenceRow[]>;

export const segmentRuleHealth = (segment: Segment, edges: RuleReferenceRow[]): RuleHealth => {
  const lens = segmentLensFor(segment.ownerModel);
  const rule = segment.conditions as Condition;
  return {
    lens,
    rule,
    references: segmentReferences(rule, lens).map((id) => ({ model: 'Segment', id })),
    live: liveRuleReferenceKeys(edges),
  };
};

export const segmentRuleIssues = (segment: Segment, edges: RuleReferenceRow[]): RuleIssue[] =>
  ruleIssues(segmentRuleHealth(segment, edges));
