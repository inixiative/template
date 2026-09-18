/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses feature:segment, infrastructure:prisma
 */
import { db } from '@template/db';
import { referenceKey } from '@template/shared/rules';
import { segmentRuleStates } from '#/modules/segment/services/segmentRuleHealth';

const SEGMENT_PREFIX = `${referenceKey({ model: 'Segment', id: '' })}`;

export const withoutDegradedSegments = async (live: ReadonlySet<string>): Promise<Set<string>> => {
  const segmentIds = [...live].filter((key) => key.startsWith(SEGMENT_PREFIX)).map((key) => key.slice(SEGMENT_PREFIX.length));
  if (!segmentIds.length) return new Set(live);
  const states = await segmentRuleStates(await db.segment.findMany({ where: { id: { in: segmentIds } } }));
  const sound = new Set(live);
  for (const [id, state] of states) if (state.issues.length) sound.delete(referenceKey({ model: 'Segment', id }));
  return sound;
};
