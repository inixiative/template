import { z } from 'zod';
import type { InquiryHandler } from '#/modules/inquiry/handlers/types';

export const createSpaceHandler: InquiryHandler = {
  contentSchema: z.object({
    organizationId: z.string(),
    name: z.string(),
  }),
  resolutionSchema: z.object({
    spaceId: z.string().optional(), // populated by handleApprove on creation
    explanation: z.string().optional(),
  }),
  handleApprove: async (_db, _inquiry, _resolvedContent) => {
    // TODO: create Space, return { spaceId: space.id }
    return {};
  },
  unique: false,
};
