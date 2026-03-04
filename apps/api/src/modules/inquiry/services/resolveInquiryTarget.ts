import type { Db, OrganizationId, SpaceId, UserId } from '@template/db';
import { InquiryResourceModel } from '@template/db/generated/client/enums';
import type { InquiryTargetMeta } from '#/modules/inquiry/handlers/types';
import { findUserOrCreateGuest } from '#/modules/user/services/findOrCreateGuest';

type InquiryTargetFields = {
  targetModel: InquiryResourceModel;
  targetUserId: UserId | null;
  targetOrganizationId: OrganizationId | null;
  targetSpaceId: SpaceId | null;
};

type TargetRequest = {
  targetUserId?: UserId | null;
  targetEmail?: string | null;
};

export const resolveInquiryTarget = async (
  db: Db,
  target: InquiryTargetMeta,
  content: Record<string, unknown>,
  request: TargetRequest,
): Promise<InquiryTargetFields> => {
  if (target.targetModel === InquiryResourceModel.User) {
    const targetUserId = request.targetUserId
      ?? (request.targetEmail ? (await findUserOrCreateGuest(db, { email: request.targetEmail })).id as UserId : null);
    return { targetModel: target.targetModel, targetUserId, targetOrganizationId: null, targetSpaceId: null };
  }
  if ('targetOrganizationId' in target) {
    return {
      targetModel: target.targetModel,
      targetUserId: null,
      targetOrganizationId: content[target.targetOrganizationId] as OrganizationId,
      targetSpaceId: null,
    };
  }
  if ('targetSpaceId' in target) {
    return {
      targetModel: target.targetModel,
      targetUserId: null,
      targetOrganizationId: null,
      targetSpaceId: content[target.targetSpaceId] as SpaceId,
    };
  }
  // admin
  return { targetModel: target.targetModel, targetUserId: null, targetOrganizationId: null, targetSpaceId: null };
};
