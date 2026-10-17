/**
 * @atlas
 * @kind service
 * @partOf feature:inquiry, primitive:authz
 * @uses infrastructure:prisma
 */
import type { Db } from '@template/db';
import {
  InquiryResourceModel,
  InquiryStatus,
  InquiryType,
} from '@template/db/generated/client/enums';
import type { GrantedEntitlements } from '#/lib/context/types';
import { entitlementGrantSchema } from '#/modules/inquiry/handlers/grantUserEntitlements';

export const findLiveEntitlementGrant = async (
  db: Db,
  inquiryId: string,
  userId: string,
): Promise<GrantedEntitlements | null> => {
  const inquiry = await db.inquiry.findFirst({
    where: {
      id: inquiryId,
      type: InquiryType.grantUserEntitlements,
      status: InquiryStatus.approved,
      targetModel: InquiryResourceModel.User,
      targetUserId: userId,
    },
  });
  if (!inquiry) return null;
  const resolution = inquiry.resolution as { grant?: unknown };
  const grant = entitlementGrantSchema.safeParse(resolution.grant);
  if (!grant.success) return null;
  return { ...grant.data, inquiryId: inquiry.id, integrationId: inquiry.sourceIntegrationId };
};
