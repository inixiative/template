import { db } from '@template/db';
import {
  baseResolutionInputSchema,
  type UpdateSpaceContent,
  updateSpaceContentSchema,
} from '@template/shared/inquiry';
import { emitAppEvent } from '#/appEvents/emit';
import type { Inquiry, InquiryService } from '#/modules/inquiry/services/types';
import { validateSpaceSlugFree } from '#/modules/inquiry/validations/validateSpaceSlugFree';

const validate = async (inquiry: Partial<Inquiry>, content: UpdateSpaceContent): Promise<void> => {
  const { slug } = content;
  if (!slug) return;

  const spaceId = inquiry.sourceSpaceId!;
  const space = await db.space.findUniqueOrThrow({ where: { id: spaceId } });

  await validateSpaceSlugFree({
    organizationId: space.organizationId,
    slug,
    spaceId,
    inquiryId: inquiry.id,
  });
};

export const updateSpaceService: InquiryService<UpdateSpaceContent> = {
  contentSchema: updateSpaceContentSchema,
  resolutionInputSchema: baseResolutionInputSchema,
  resolutionSchema: baseResolutionInputSchema,
  defaultExpirationDays: 90,
  validate,
  autoApprove: async () => false,

  handleApprove: async (_c, inquiry, content) => {
    const space = await db.space.update({
      where: { id: inquiry.sourceSpaceId! },
      data: content,
    });
    await emitAppEvent('space.updated', { space });
  },
  unique: 'untargeted',
};
