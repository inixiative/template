/**
 * @atlas
 * @kind validator
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import type { Condition } from '@inixiative/json-rules';
import { deadRuleReferences, ruleReferences } from '@template/db';
import type { ProviderModel } from '@template/db/generated/client/enums';
import { deadReferencesError } from '#/hooks/ruleReference/deadReferencesError';
import {
  customerRefLens,
  resolvedCustomerRefLens,
} from '#/modules/customerRef/lib/customerRefLens';

type Candidate = {
  ownerModel: ProviderModel;
  ownerId: string;
  conditions: Condition;
};

/** Refuses a rule that references rows that are deleted or outside the owner's scope. */
export const assertSegmentReferencesOwned = async ({
  ownerModel,
  ownerId,
  conditions,
}: Candidate): Promise<void> => {
  const references = ruleReferences(customerRefLens, conditions);
  const dead = await deadRuleReferences([
    { lens: resolvedCustomerRefLens(ownerModel, ownerId), references },
  ]);
  if (dead.length) throw deadReferencesError(dead);
};
