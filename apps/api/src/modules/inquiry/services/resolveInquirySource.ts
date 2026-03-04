import type { OrganizationId, SpaceId, UserId } from '@template/db';
import type { User } from '@template/db/generated/client/client';
import { InquiryResourceModel } from '@template/db/generated/client/enums';
import type { InquiryHandler } from '#/modules/inquiry/handlers/types';

type InquirySourceFields = {
  sourceModel: InquiryResourceModel;
  sourceUserId: UserId | null;
  sourceOrganizationId: OrganizationId | null;
  sourceSpaceId: SpaceId | null;
};

export const resolveInquirySource = (
  handler: InquiryHandler,
  content: Record<string, unknown>,
  user: User,
): InquirySourceFields => {
  const source = handler.sources[0];
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
    sourceModel: source.sourceModel,
    sourceUserId: source.sourceModel === InquiryResourceModel.User ? (user.id as UserId) : null,
    sourceOrganizationId: null,
    sourceSpaceId: null,
  };
};
