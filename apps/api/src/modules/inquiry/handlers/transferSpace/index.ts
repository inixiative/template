import { z } from 'zod';
import { InquiryResourceModel, InquiryType } from '@template/db/generated/client/enums';
import type { Db, SpaceId } from '@template/db';
import type { InquiryHandler, Inquiry } from '#/modules/inquiry/handlers/types';
import { baseResolutionInputSchema } from '#/modules/inquiry/handlers/schemas';
import { inquiryTerminalStatuses } from '#/modules/inquiry/services/utils/validateInquiryStatus';
import { makeError } from '#/lib/errors';

type TransferSpaceContent = Record<string, never>;

const validate = async (db: Db, inquiry: Partial<Inquiry>, _content: TransferSpaceContent): Promise<void> => {
  const existing = await db.inquiry.findFirst({
    where: {
      type: InquiryType.transferSpace,
      sourceSpaceId: inquiry.sourceSpaceId as SpaceId,
      status: { notIn: inquiryTerminalStatuses },
    },
  });
  if (existing) throw makeError({ status: 409, message: 'An open transfer request already exists for this space' });
};

export const transferSpaceHandler: InquiryHandler<TransferSpaceContent> = {
  sources: [{ sourceModel: InquiryResourceModel.Space }],
  targets: [{ targetModel: InquiryResourceModel.Organization }],
  contentSchema: z.object({}),
  resolutionInputSchema: baseResolutionInputSchema,
  resolutionSchema: baseResolutionInputSchema,
  validate,
  handleApprove: async (_db, _inquiry, _resolvedContent) => {
    // TODO: implement transferSpace approval
  },
};
