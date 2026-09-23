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

type Holder = { ownerModel: ProviderModel; ownerId: string; audienceOf?: string | null };

const assertInternalAudienceOf = async (segment: Segment, holder: Holder): Promise<void> => {
  if (holder.audienceOf === undefined) {
    throw makeError({ status: 422, message: `Segment ${segment.id} is a feature flag variant's internal audience` });
  }
  const referrers = await db.featureFlagVariant.findMany({ where: { segmentId: segment.id, deletedAt: null } });
  if (referrers.some((variant) => variant.id !== holder.audienceOf)) {
    throw makeError({ status: 422, message: `Segment ${segment.id} is another variant's internal audience` });
  }
};

/** A live segment of the same owner; an internal one only as the audience of the variant already serving it. */
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
  if (segment.featureFlagInternal) await assertInternalAudienceOf(segment, holder);
  return segment;
};
