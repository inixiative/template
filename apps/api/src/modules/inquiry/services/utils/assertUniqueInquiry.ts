import type { Db } from '@template/db';
import type { InquiryType } from '@template/db/generated/client/enums';
import { makeError } from '#/lib/errors';

type UniqueInquiryParams = {
  type: InquiryType;
  sourceUserId?: string | null;
  sourceOrganizationId?: string | null;
  sourceSpaceId?: string | null;
  targetUserId?: string | null;
  targetOrganizationId?: string | null;
  targetSpaceId?: string | null;
};

export const assertUniqueInquiry = async (db: Db, params: UniqueInquiryParams, requestId?: string): Promise<void> => {
  const existing = await db.inquiry.findFirst({
    where: {
      type: params.type,
      status: { notIn: ['approved', 'denied', 'canceled'] },
      ...(params.sourceUserId !== undefined && { sourceUserId: params.sourceUserId }),
      ...(params.sourceOrganizationId !== undefined && { sourceOrganizationId: params.sourceOrganizationId }),
      ...(params.sourceSpaceId !== undefined && { sourceSpaceId: params.sourceSpaceId }),
      ...(params.targetUserId !== undefined && { targetUserId: params.targetUserId }),
      ...(params.targetOrganizationId !== undefined && { targetOrganizationId: params.targetOrganizationId }),
      ...(params.targetSpaceId !== undefined && { targetSpaceId: params.targetSpaceId }),
    },
  });

  if (existing) {
    throw makeError({ status: 409, message: 'An open inquiry of this type already exists between these parties', requestId });
  }
};
