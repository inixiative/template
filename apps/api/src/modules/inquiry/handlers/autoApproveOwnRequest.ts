/**
 * @atlas
 * @kind handler
 * @partOf feature:inquiry
 * @uses none
 */
import { InquiryResourceModel } from '@template/db/generated/client/enums';
import type { Inquiry } from '#/modules/inquiry/handlers/types';

export const autoApproveOwnRequest = async (_db: unknown, inquiry: Inquiry): Promise<boolean> =>
  inquiry.sourceModel === InquiryResourceModel.User &&
  inquiry.targetModel === InquiryResourceModel.User &&
  inquiry.sourceUserId === inquiry.targetUserId;
