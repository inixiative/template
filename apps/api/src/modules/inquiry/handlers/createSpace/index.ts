import { z } from 'zod';
import type { InquiryHandler } from '#/modules/inquiry/handlers/types';

export const createSpaceHandler: InquiryHandler = {
  contentSchema: z.object({
    organizationId: z.string(),
    name: z.string(),
  }),
  resolutionSchema: z.object({
    explanation: z.string().optional(),
  }),
  handleApprove: async (_db, _inquiry, _resolvedContent) => {
    // TODO: implement createSpace approval
  },
  unique: false,
};
