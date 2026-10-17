/**
 * @atlas
 * @kind service
 * @partOf feature:inquiry, primitive:authz
 * @uses infrastructure:prisma
 */
import type { Db } from '@template/db';
import { InquiryStatus, InquiryType } from '@template/db/generated/client/enums';
import type { SliceGrant } from '#/lib/context/types';
import { sliceSchema } from '#/modules/inquiry/handlers/grantUserSlice';

export const findLiveSliceGrant = async (
  db: Db,
  inquiryId: string,
  userId: string,
): Promise<SliceGrant | null> => {
  const inquiry = await db.inquiry.findFirst({
    where: {
      id: inquiryId,
      type: InquiryType.grantUserSlice,
      status: InquiryStatus.approved,
      targetUserId: userId,
    },
  });
  if (!inquiry) return null;
  const resolution = inquiry.resolution as { slice?: unknown };
  const slice = sliceSchema.safeParse(resolution.slice);
  if (!slice.success) return null;
  return { ...slice.data, inquiryId: inquiry.id, integrationId: inquiry.sourceIntegrationId };
};
