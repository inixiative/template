/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses feature:segment, infrastructure:prisma
 */
import { db } from '@template/db';
import { type RuleReference, referenceKey } from '@template/shared/rules';
import { segmentRuleStates } from '#/modules/segment/services/segmentRuleHealth';

export const withoutDegradedSegments = async (references: RuleReference[]): Promise<Set<string>> => {
  const live = new Set(references.map(referenceKey));
  const segmentIds = references.filter((reference) => reference.model === 'Segment').map((reference) => reference.id);
  if (!segmentIds.length) return live;
  const states = await segmentRuleStates(await db.segment.findMany({ where: { id: { in: segmentIds } } }));
  for (const [id, state] of states) if (state.issues.length) live.delete(referenceKey({ model: 'Segment', id }));
  return live;
};
