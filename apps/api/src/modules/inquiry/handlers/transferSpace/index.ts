import type { OrganizationId, SpaceId } from '@template/db';
import { InquiryResourceModel } from '@template/db/generated/client/enums';
import {
  baseResolutionInputSchema,
  type TransferSpaceContent,
  transferSpaceContentSchema,
} from '@template/shared/inquiry';
import { emitAppEvent } from '#/appEvents/emit';
import type { InquiryHandler } from '#/modules/inquiry/handlers/types';

export const transferSpaceHandler: InquiryHandler<TransferSpaceContent> = {
  sources: [{ sourceModel: InquiryResourceModel.Space }],
  targets: [{ targetModel: InquiryResourceModel.Organization }],
  contentSchema: transferSpaceContentSchema,
  resolutionInputSchema: baseResolutionInputSchema,
  resolutionSchema: baseResolutionInputSchema,
  unique: 'untargeted',
  defaultExpirationDays: 30,
  autoApprove: async () => false,

  handleApprove: async (db, inquiry) => {
    const space = await db.space.update({
      where: { id: inquiry.sourceSpaceId as SpaceId },
      data: { organizationId: inquiry.targetOrganizationId as OrganizationId },
    });
    await emitAppEvent('space.updated', { space });
  },
};
