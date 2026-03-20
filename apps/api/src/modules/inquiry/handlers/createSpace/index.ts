import type { Db, OrganizationId } from '@template/db';
import { InquiryResourceModel, InquiryType } from '@template/db/generated/client/enums';
import { z } from 'zod';
import { makeError } from '#/lib/errors';
import { baseResolutionInputSchema } from '#/modules/inquiry/handlers/schemas';
import type { Inquiry, InquiryHandler } from '#/modules/inquiry/handlers/types';
import { inquiryTerminalStatuses } from '#/modules/inquiry/validations/validateInquiryStatus';

export const spaceContentSchema = z.object({
  name: z.string(),
  slug: z.string(),
});

const resolutionSchema = baseResolutionInputSchema.extend({
  spaceId: z.string().optional(),
});

export type SpaceContent = z.infer<typeof spaceContentSchema>;
type CreateSpaceContent = SpaceContent;
type CreateSpaceResolution = z.infer<typeof resolutionSchema>;

const validate = async (db: Db, inquiry: Partial<Inquiry>, content: CreateSpaceContent): Promise<void> => {
  const organizationId = inquiry.sourceOrganizationId as OrganizationId;
  const { slug } = content;

  const [existingSpace, existingInquiry] = await Promise.all([
    db.space.findFirst({ where: { organizationId, slug } }),
    db.inquiry.findFirst({
      where: {
        type: InquiryType.createSpace,
        sourceOrganizationId: organizationId,
        status: { notIn: inquiryTerminalStatuses },
        content: { path: ['slug'], equals: slug },
        ...(inquiry.id && { id: { not: inquiry.id } }),
      },
    }),
  ]);

  if (existingSpace) throw makeError({ status: 409, message: 'A space with this slug already exists' });
  if (existingInquiry)
    throw makeError({ status: 409, message: 'An open request to create a space with this slug already exists' });
};

export const createSpaceHandler: InquiryHandler<CreateSpaceContent, CreateSpaceResolution> = {
  sources: [{ sourceModel: InquiryResourceModel.Organization }],
  targets: [{ targetModel: InquiryResourceModel.admin }],
  contentSchema: spaceContentSchema,
  resolutionInputSchema: baseResolutionInputSchema,
  resolutionSchema,
  defaultExpirationDays: 90,
  validate,
  autoApprove: async () => false,

  handleApprove: async (db, inquiry, content) => {
    const space = await db.space.create({
      data: { ...content, organizationId: inquiry.sourceOrganizationId as OrganizationId },
    });
    return { spaceId: space.id };
  },
};
