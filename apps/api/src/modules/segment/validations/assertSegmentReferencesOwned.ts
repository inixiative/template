/**
 * @atlas
 * @kind validator
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import { type Condition, sourceQueries } from '@inixiative/json-rules';
import { admitRuleReferences, ruleReferences } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import type { ProviderModel } from '@template/db/generated/client/enums';
import { referenceKey } from '@template/shared/rules';
import { customerRefLens, ownedSegments, resolvedCustomerRefLens } from '#/modules/customerRef/lib/customerRefLens';
import { invalidSegmentConditions } from '#/modules/segment/lib/invalidSegmentConditions';

type Candidate = {
  ownerModel: ProviderModel;
  ownerId: string;
  conditions: Condition;
  held?: string[];
};

/** Refuses a rule naming rows the owner's lens does not admit; returns the owner's live segments for the cycle check. */
export const assertSegmentReferencesOwned = async ({
  ownerModel,
  ownerId,
  conditions,
  held = [],
}: Candidate): Promise<Segment[]> => {
  const added = ruleReferences(customerRefLens, conditions).filter(
    (reference) => !held.includes(referenceKey(reference)),
  );
  if (added.length) {
    const { unadmitted } = await admitRuleReferences(
      sourceQueries(resolvedCustomerRefLens(ownerModel, ownerId)),
      added,
    );
    if (unadmitted.length) {
      throw invalidSegmentConditions(
        unadmitted.map(
          (reference) => `references a ${reference.model} this ${ownerModel} does not own: ${reference.id}`,
        ),
      );
    }
  }
  return ownedSegments(ownerModel, ownerId);
};
