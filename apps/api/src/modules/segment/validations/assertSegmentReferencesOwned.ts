/**
 * @atlas
 * @kind validator
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import type { Condition } from '@inixiative/json-rules';
import { assertRuleReferencesExist, ruleReferences } from '@template/db';
import type { ProviderModel } from '@template/db/generated/client/enums';
import { customerRefLens } from '#/modules/customerRef/lib/lenses/customerRefLens';
import { resolvedCustomerRefLens } from '#/modules/customerRef/lib/resolvedCustomerRefLens';

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
  await assertRuleReferencesExist([
    { lens: resolvedCustomerRefLens(ownerModel, ownerId), references },
  ]);
};
