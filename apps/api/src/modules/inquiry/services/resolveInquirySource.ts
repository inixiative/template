import type { OrganizationId, SpaceId, UserId } from '@template/db';
import { InquiryResourceModel } from '@template/db/generated/client/enums';
import type { InquirySourceMeta } from '#/modules/inquiry/handlers/types';

type InquirySourceFields = {
  sourceModel: InquiryResourceModel;
  sourceUserId: UserId | null;
  sourceOrganizationId: OrganizationId | null;
  sourceSpaceId: SpaceId | null;
};

export const resolveInquirySource = (
  source: InquirySourceMeta,
  content: Record<string, unknown>,
  userId: UserId,
): InquirySourceFields => {
  if ('sourceOrganizationId' in source) {
    return {
      sourceModel: source.sourceModel,
      sourceUserId: null,
      sourceOrganizationId: content[source.sourceOrganizationId] as OrganizationId,
      sourceSpaceId: null,
    };
  }
  if ('sourceSpaceId' in source) {
    return {
      sourceModel: source.sourceModel,
      sourceUserId: null,
      sourceOrganizationId: null,
      sourceSpaceId: content[source.sourceSpaceId] as SpaceId,
    };
  }
  return {
    sourceModel: InquiryResourceModel.User,
    sourceUserId: userId,
    sourceOrganizationId: null,
    sourceSpaceId: null,
  };
};
