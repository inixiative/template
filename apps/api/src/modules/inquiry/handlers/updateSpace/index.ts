import { z } from 'zod';
import { InquiryResourceModel } from '@template/db/generated/client/enums';
import type { InquiryHandler } from '#/modules/inquiry/handlers/types';

export const updateSpaceHandler: InquiryHandler = {
  sources: [{ sourceModel: InquiryResourceModel.Space, sourceSpaceId: 'spaceId' }],
  targets: [{ targetModel: InquiryResourceModel.admin }],
  contentSchema: z.object({
    spaceId: z.string(),
  }),
  resolutionSchema: z.object({
    explanation: z.string().optional(),
  }),
  handleApprove: async (_db, _inquiry, _resolvedContent) => {
    // TODO: implement updateSpace approval
  },
  unique: true,
};
