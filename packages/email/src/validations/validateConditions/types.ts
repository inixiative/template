/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses primitive:shared
 */
import type { Lens, LensNarrowing } from '@inixiative/json-rules';

export type ValidateConditionsOptions = {
  isSubject?: boolean;
  lens?: Lens | LensNarrowing;
};

export type ConditionNode = Record<string, unknown>;
