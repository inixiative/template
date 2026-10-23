/**
 * @atlas
 * @kind validator
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import type { Condition } from '@inixiative/json-rules';
import { describeRuleReferenceRefusals, ruleReferenceRefusals, ruleReferences } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import type { ProviderModel } from '@template/db/generated/client/enums';
import {
  customerRefLens,
  ownedSegments,
  resolvedCustomerRefLens,
} from '#/modules/customerRef/lib/customerRefLens';
import { invalidSegmentConditions } from '#/modules/segment/lib/invalidSegmentConditions';

type Candidate = {
  ownerModel: ProviderModel;
  ownerId: string;
  conditions: Condition;
  segmentId?: string;
};

/** Refuses a rule naming rows the owner's lens does not admit, or rows that are gone; returns the owner's live segments for the cycle check. */
export const assertSegmentReferencesOwned = async ({
  ownerModel,
  ownerId,
  conditions,
  segmentId,
}: Candidate): Promise<Segment[]> => {
  const references = ruleReferences(customerRefLens, conditions);
  const refusals = await ruleReferenceRefusals({
    references,
    scopes: [{ lens: resolvedCustomerRefLens(ownerModel, ownerId), references }],
    source: segmentId ? { model: 'Segment', id: segmentId } : undefined,
  });
  if (refusals.length) throw invalidSegmentConditions(describeRuleReferenceRefusals(refusals));
  return ownedSegments(ownerModel, ownerId);
};
