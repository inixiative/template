import type { Db, SpaceId } from '@template/db';
import { InquiryResourceModel, InquiryType } from '@template/db/generated/client/enums';
import type { z } from 'zod';
import { makeError } from '#/lib/errors';
import { spaceContentSchema } from '#/modules/inquiry/handlers/createSpace';
import { baseResolutionInputSchema } from '#/modules/inquiry/handlers/schemas';
import type { Inquiry, InquiryHandler } from '#/modules/inquiry/handlers/types';
import { inquiryTerminalStatuses } from '#/modules/inquiry/validations/validateInquiryStatus';

const contentSchema = spaceContentSchema.partial();

type UpdateSpaceContent = z.infer<typeof contentSchema>;

const validate = async (db: Db, inquiry: Partial<Inquiry>, content: UpdateSpaceContent): Promise<void> => {
  const { slug } = content;
  if (!slug) return;

  const spaceId = inquiry.sourceSpaceId as SpaceId;
  const space = await db.space.findUniqueOrThrow({ where: { id: spaceId } });

  const [existingSpace, existingInquiry] = await Promise.all([
    db.space.findFirst({ where: { organizationId: space.organizationId, slug, id: { not: spaceId } } }),
    db.inquiry.findFirst({
      where: {
        type: InquiryType.updateSpace,
        sourceSpaceId: spaceId,
        status: { notIn: inquiryTerminalStatuses },
        content: { path: ['slug'], equals: slug },
      },
    }),
  ]);

  if (existingSpace) throw makeError({ status: 409, message: 'A space with this slug already exists' });
  if (existingInquiry)
    throw makeError({ status: 409, message: 'An open request to update this space to this slug already exists' });
};

export const updateSpaceHandler: InquiryHandler<UpdateSpaceContent> = {
  sources: [{ sourceModel: InquiryResourceModel.Space }],
  targets: [{ targetModel: InquiryResourceModel.admin }],
  contentSchema,
  resolutionInputSchema: baseResolutionInputSchema,
  resolutionSchema: baseResolutionInputSchema,
  defaultExpirationDays: 90,
  validate,
  handleApprove: async (db, inquiry, content) => {
    await db.space.update({
      where: { id: inquiry.sourceSpaceId as SpaceId },
      data: content,
    });
  },
  unique: 'untargeted',
};
