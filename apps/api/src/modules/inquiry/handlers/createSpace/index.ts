import { z } from 'zod';
import { InquiryResourceModel } from '@template/db/generated/client/enums';
import type { InquiryHandler } from '#/modules/inquiry/handlers/types';

export const createSpaceHandler: InquiryHandler = {
  sources: [{ sourceModel: InquiryResourceModel.Organization, sourceOrganizationId: 'organizationId' }],
  targets: [{ targetModel: null }],
  contentSchema: z.object({
    organizationId: z.string(),
    name: z.string(),
  }),
  resolutionSchema: z.object({
    spaceId: z.string().optional(),
    explanation: z.string().optional(),
  }),
  handleApprove: async (_db, _inquiry, _resolvedContent) => {
    // TODO: create Space, return { spaceId: space.id }
    return {};
  },
  unique: false,
};
