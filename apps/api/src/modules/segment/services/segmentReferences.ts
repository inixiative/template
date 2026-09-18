/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import type { Condition, LensNarrowing } from '@inixiative/json-rules';
import { ruleReferences } from '@template/db';

export const segmentReferences = (conditions: Condition, lens: LensNarrowing): string[] =>
  ruleReferences(lens, conditions)
    .filter((reference) => reference.model === 'Segment')
    .map((reference) => reference.id);
