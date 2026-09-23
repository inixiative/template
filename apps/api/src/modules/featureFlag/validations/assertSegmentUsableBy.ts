/**
 * @atlas
 * @kind validator
 * @partOf feature:featureFlag
 * @uses infrastructure:prisma, feature:segment
 */
import { db } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import type { ProviderModel } from '@template/db/generated/client/enums';
import { makeError } from '#/lib/errors';
import { segmentOwnerWhere } from '#/modules/segment/lib/segmentOwner';

type Holder = { ownerModel: ProviderModel; ownerId: string; internalTo?: string };

/** A live segment of the same owner that is nobody else's internal audience. */
export const assertSegmentUsableBy = async (segmentId: string, holder: Holder): Promise<Segment> => {
  const segment = await db.segment.findFirst({
    where: { id: segmentId, ...segmentOwnerWhere(holder.ownerModel, holder.ownerId), deletedAt: null },
  });
  if (!segment) {
    throw makeError({
      status: 422,
      message: `Segment ${segmentId} is not a live segment of this ${holder.ownerModel}`,
    });
  }
  if (segment.featureFlagVariantId && segment.featureFlagVariantId !== holder.internalTo) {
    throw makeError({ status: 422, message: `Segment ${segmentId} is another variant's internal audience` });
  }
  return segment;
};
