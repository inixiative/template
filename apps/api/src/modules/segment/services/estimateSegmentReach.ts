/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import type { Condition } from '@inixiative/json-rules';
import { db } from '@template/db';
import type { ProviderModel } from '@template/db/generated/client/enums';
import { invalidSegmentConditionsError } from '#/modules/segment/lib/invalidSegmentConditionsError';
import { compileSegmentWhere } from '#/modules/segment/services/evaluateSegment';
import { assertSegmentReferencesOwned } from '#/modules/segment/validations/assertSegmentReferencesOwned';
import { validateSegmentConditions } from '#/modules/segment/validations/validateSegmentConditions';

export const estimateSegmentReach = async (
  ownerModel: ProviderModel,
  ownerId: string,
  rawConditions: unknown,
): Promise<number> => {
  const validation = validateSegmentConditions(rawConditions, ownerModel);
  if (!validation.valid) throw invalidSegmentConditionsError(validation.errors);
  const conditions = validation.normalized as Condition;
  await assertSegmentReferencesOwned({ ownerModel, ownerId, conditions });
  return db.customerRelationship.count({
    where: await compileSegmentWhere(ownerModel, ownerId, conditions),
  });
};
