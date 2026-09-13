/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses none
 */
import { type Condition, type LensNarrowing, ruleSourceValues } from '@inixiative/json-rules';

export const segmentReferences = (conditions: Condition, lens: LensNarrowing): string[] => {
  const ids = new Set<string>();
  for (const source of ruleSourceValues(lens, conditions)) {
    if (source.model !== 'Segment' || source.field !== 'id') continue;
    for (const value of source.values) if (typeof value === 'string') ids.add(value);
  }
  return [...ids];
};
