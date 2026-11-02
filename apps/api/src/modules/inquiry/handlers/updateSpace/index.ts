import { db } from '@template/db';
import { InquiryResourceModel, InquiryType } from '@template/db/generated/client/enums';
import {
  baseResolutionInputSchema,
  type UpdateSpaceContent,
  updateSpaceContentSchema,
} from '@template/shared/inquiry';
import { emitAppEvent } from '#/appEvents/emit';
import { makeError } from '#/lib/errors';
import type { Inquiry, InquiryHandler } from '#/modules/inquiry/handlers/types';
import { inquiryTerminalStatuses } from '#/modules/inquiry/validations/validateInquiryStatus';
import { validateSpaceSlugFree } from '#/modules/inquiry/validations/validateSpaceSlugFree';

const validate = async (inquiry: Partial<Inquiry>, content: UpdateSpaceContent): Promise<void> => {
  const { slug } = content;
  if (!slug) return;

  const spaceId = inquiry.sourceSpaceId!;
  const space = await db.space.findUniqueOrThrow({ where: { id: spaceId } });

  await validateSpaceSlugFree({ organizationId: space.organizationId, slug, spaceId });

  const existingInquiry = await db.inquiry.findFirst({
    where: {
      id: { not: inquiry.id },
      type: InquiryType.updateSpace,
      sourceSpaceId: spaceId,
      status: { notIn: inquiryTerminalStatuses },
      content: { path: ['slug'], equals: slug },
    },
  });
  if (existingInquiry)
    throw makeError({
      status: 409,
      message: 'An open request to update this space to this slug already exists',
    });
};

export const updateSpaceHandler: InquiryHandler<UpdateSpaceContent> = {
  sources: [{ sourceModel: InquiryResourceModel.Space }],
  targets: [{ targetModel: InquiryResourceModel.admin }],
  contentSchema: updateSpaceContentSchema,
  resolutionInputSchema: baseResolutionInputSchema,
  resolutionSchema: baseResolutionInputSchema,
  defaultExpirationDays: 90,
  validate,
  autoApprove: async () => false,

  handleApprove: async (inquiry, content) => {
    const space = await db.space.update({
      where: { id: inquiry.sourceSpaceId! },
      data: content,
    });
    await emitAppEvent('space.updated', { space });
  },
  unique: 'untargeted',
};
