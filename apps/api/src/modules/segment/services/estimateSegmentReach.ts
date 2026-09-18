/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import type { Condition } from '@inixiative/json-rules';
import { type Db, db as defaultDb } from '@template/db';
import type { ProviderModel } from '@template/db/generated/client/enums';
import { invalidSegmentConditions } from '#/modules/segment/lib/invalidSegmentConditions';
import { assertSegmentReferencesOwned } from '#/modules/segment/services/assertSegmentReferencesOwned';
import { compileSegmentWhere } from '#/modules/segment/services/evaluateSegment';
import { validateSegmentConditions } from '#/modules/segment/services/validateSegmentConditions';

export const estimateSegmentReach = async (
  ownerModel: ProviderModel,
  ownerId: string,
  rawConditions: unknown,
  db: Db = defaultDb,
): Promise<number> => {
  const validation = validateSegmentConditions(rawConditions, ownerModel);
  if (!validation.valid) throw invalidSegmentConditions(validation.errors);
  const conditions = validation.normalized as Condition;
  await assertSegmentReferencesOwned({ ownerModel, ownerId, conditions }, db);
  return db.customerRef.count({ where: await compileSegmentWhere(ownerModel, ownerId, conditions, db) });
};
