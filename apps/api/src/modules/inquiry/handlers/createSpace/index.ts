import { db } from '@template/db';
import { InquiryResourceModel, InquiryType } from '@template/db/generated/client/enums';
import {
  baseResolutionInputSchema,
  type CreateSpaceResolution,
  createSpaceResolutionSchema,
  type SpaceContent,
  spaceContentSchema,
} from '@template/shared/inquiry';
import type { Inquiry, InquiryHandler } from '#/modules/inquiry/handlers/types';
import { validateSpaceSlugFree } from '#/modules/inquiry/validations/validateSpaceSlugFree';

type CreateSpaceContent = SpaceContent;

const validate = (inquiry: Partial<Inquiry>, content: CreateSpaceContent): Promise<void> =>
  validateSpaceSlugFree({
    organizationId: inquiry.sourceOrganizationId!,
    slug: content.slug,
    inquiryId: inquiry.id,
  });

export const createSpaceHandler: InquiryHandler<CreateSpaceContent, CreateSpaceResolution> = {
  sources: [{ sourceModel: InquiryResourceModel.Organization }],
  targets: [{ targetModel: InquiryResourceModel.admin }],
  contentSchema: spaceContentSchema,
  resolutionInputSchema: baseResolutionInputSchema,
  resolutionSchema: createSpaceResolutionSchema,
  defaultExpirationDays: 90,
  validate,
  autoApprove: async () => false,

  handleApprove: async (inquiry, content) => {
    const space = await db.space.create({
      data: { ...content, organizationId: inquiry.sourceOrganizationId! },
    });
    return { spaceId: space.id };
  },
};
