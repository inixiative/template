/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses none
 */
import { type Condition, type LensNarrowing, ruleSourceValues } from '@inixiative/json-rules';

export type SegmentReferences = { ids: string[]; dynamic: boolean };

export const segmentReferences = (conditions: Condition, lens: LensNarrowing): SegmentReferences => {
  const ids = new Set<string>();
  let dynamic = false;
  for (const source of ruleSourceValues(lens, conditions)) {
    if (source.model !== 'Segment' || source.field !== 'id') continue;
    if (source.dynamic) dynamic = true;
    for (const value of source.values) if (typeof value === 'string') ids.add(value);
  }
  return { ids: [...ids], dynamic };
};
