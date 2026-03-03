import { z } from 'zod';
import type { InquiryHandler } from '#/modules/inquiry/handlers/types';

export const updateSpaceHandler: InquiryHandler = {
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
