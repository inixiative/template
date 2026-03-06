import type { Db, OrganizationId, SpaceId, UserId } from '@template/db';
import { InquiryType } from '@template/db/generated/client/enums';
import { makeError } from '#/lib/errors';
import { inquiryTerminalStatuses } from '#/modules/inquiry/validations/validateInquiryStatus';

type UniqueInquiryParams = {
  type: InquiryType;
  sourceUserId?: UserId | null;
  sourceOrganizationId?: OrganizationId | null;
  sourceSpaceId?: SpaceId | null;
  targetUserId?: UserId | null;
  targetOrganizationId?: OrganizationId | null;
  targetSpaceId?: SpaceId | null;
};

export const validateUniqueInquiry = async (db: Db, params: UniqueInquiryParams): Promise<void> => {
  const existing = await db.inquiry.findFirst({
    where: {
      type: params.type,
      status: { notIn: inquiryTerminalStatuses },
      ...(params.sourceUserId !== undefined && { sourceUserId: params.sourceUserId }),
      ...(params.sourceOrganizationId !== undefined && { sourceOrganizationId: params.sourceOrganizationId }),
      ...(params.sourceSpaceId !== undefined && { sourceSpaceId: params.sourceSpaceId }),
      ...(params.targetUserId !== undefined && { targetUserId: params.targetUserId }),
      ...(params.targetOrganizationId !== undefined && { targetOrganizationId: params.targetOrganizationId }),
      ...(params.targetSpaceId !== undefined && { targetSpaceId: params.targetSpaceId }),
    },
  });

  if (existing) {
    throw makeError({ status: 409, message: 'An open inquiry of this type already exists between these parties' });
  }
};
