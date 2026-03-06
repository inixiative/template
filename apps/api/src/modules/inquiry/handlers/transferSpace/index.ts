import { z } from 'zod';
import { InquiryResourceModel } from '@template/db/generated/client/enums';
import type { OrganizationId, SpaceId } from '@template/db';
import type { InquiryHandler } from '#/modules/inquiry/handlers/types';
import { baseResolutionInputSchema } from '#/modules/inquiry/handlers/schemas';

type TransferSpaceContent = Record<string, never>;

export const transferSpaceHandler: InquiryHandler<TransferSpaceContent> = {
  sources: [{ sourceModel: InquiryResourceModel.Space }],
  targets: [{ targetModel: InquiryResourceModel.Organization }],
  contentSchema: z.object({}),
  resolutionInputSchema: baseResolutionInputSchema,
  resolutionSchema: baseResolutionInputSchema,
  unique: 'untargeted',
  handleApprove: async (db, inquiry) => {
    await db.space.update({
      where: { id: inquiry.sourceSpaceId as SpaceId },
      data: { organizationId: inquiry.targetOrganizationId as OrganizationId },
    });
  },
};
