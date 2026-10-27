/**
 * @atlas
 * @kind validator
 * @partOf infrastructure:prisma
 * @uses primitive:shared
 */
import { RuleReferenceError } from '@template/db/utils/ruleReferenceError';
import {
  deadRuleReferences,
  type ReferenceScope,
} from '@template/db/validations/deadRuleReferences';
import type { RuleReference } from '@template/shared/rules';

/** Refuses a rule that references rows that are deleted or outside their scope's owner scope. */
export const assertRuleReferencesExist = async (
  scopes: ReferenceScope[],
  references?: RuleReference[],
): Promise<void> => {
  const dead = await deadRuleReferences(scopes, references);
  if (dead.length)
    throw new RuleReferenceError('The rule references rows that are deleted or missing', dead);
};
