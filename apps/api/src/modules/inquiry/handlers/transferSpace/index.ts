import { z } from 'zod';
import { InquiryResourceModel } from '@template/db/generated/client/enums';
import type { InquiryHandler } from '#/modules/inquiry/handlers/types';
import { baseResolutionInputSchema } from '#/modules/inquiry/handlers/schemas';

type TransferSpaceContent = Record<string, never>;

export const transferSpaceHandler: InquiryHandler<TransferSpaceContent> = {
  sources: [{ sourceModel: InquiryResourceModel.Space }],
  targets: [{ targetModel: InquiryResourceModel.Organization }],
  contentSchema: z.object({}),
  resolutionInputSchema: baseResolutionInputSchema,
  resolutionSchema: baseResolutionInputSchema,
  handleApprove: async (_db, _inquiry, _resolvedContent) => {
    // TODO: implement transferSpace approval
  },
  unique: true,
};
