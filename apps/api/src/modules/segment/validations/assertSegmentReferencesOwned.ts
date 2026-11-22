/**
 * @atlas
 * @kind validator
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import type { Condition } from '@inixiative/json-rules';
import { assertRuleReferencesExist, ruleReferences } from '@template/db';
import type { ProviderModel } from '@template/db/generated/client/enums';
import { customerRelationshipLens } from '#/modules/customerRelationship/lib/lenses/customerRelationshipLens';
import { resolvedCustomerRelationshipLens } from '#/modules/customerRelationship/lib/resolvedCustomerRelationshipLens';

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
  const references = ruleReferences(customerRelationshipLens, conditions);
  await assertRuleReferencesExist([
    { lens: resolvedCustomerRelationshipLens(ownerModel, ownerId), references },
  ]);
};
