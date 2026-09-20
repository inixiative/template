/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import type { Condition } from '@inixiative/json-rules';
import { db } from '@template/db';
import type { ProviderModel } from '@template/db/generated/client/enums';
import { invalidSegmentConditions } from '#/modules/segment/lib/invalidSegmentConditions';
import { compileSegmentWhere } from '#/modules/segment/services/evaluateSegment';
import { assertSegmentReferencesOwned } from '#/modules/segment/validations/assertSegmentReferencesOwned';
import { validateSegmentConditions } from '#/modules/segment/validations/validateSegmentConditions';

export const estimateSegmentReach = async (
  ownerModel: ProviderModel,
  ownerId: string,
  rawConditions: unknown,
): Promise<number> => {
  const validation = validateSegmentConditions(rawConditions, ownerModel);
  if (!validation.valid) throw invalidSegmentConditions(validation.errors);
  const conditions = validation.normalized as Condition;
  await assertSegmentReferencesOwned({ ownerModel, ownerId, conditions });
  return db.customerRef.count({ where: await compileSegmentWhere(ownerModel, ownerId, conditions) });
};
