import { InquiryResourceModel, InquiryType } from '@template/db/generated/client/enums';
import type { Db, SpaceId } from '@template/db';
import type { InquiryHandler, Inquiry } from '#/modules/inquiry/handlers/types';
import { baseResolutionInputSchema } from '#/modules/inquiry/handlers/schemas';
import { spaceContentSchema } from '#/modules/inquiry/handlers/createSpace';
import { TERMINAL_STATUSES } from '#/modules/inquiry/validations/validateInquiryMutable';
import { makeError } from '#/lib/errors';

const contentSchema = spaceContentSchema.partial();

type UpdateSpaceContent = typeof contentSchema._type;

const validate = async (db: Db, inquiry: Inquiry): Promise<void> => {
  const { slug } = inquiry.content as UpdateSpaceContent;
  if (!slug) return;

  const spaceId = inquiry.sourceSpaceId as SpaceId;
  const space = await db.space.findUniqueOrThrow({ where: { id: spaceId } });

  const [existingSpace, existingInquiry] = await Promise.all([
    db.space.findFirst({ where: { organizationId: space.organizationId, slug, id: { not: spaceId } } }),
    db.inquiry.findFirst({
      where: {
        type: InquiryType.updateSpace,
        sourceSpaceId: spaceId,
        status: { notIn: TERMINAL_STATUSES },
        content: { path: ['slug'], equals: slug },
      },
    }),
  ]);

  if (existingSpace) throw makeError({ status: 409, message: 'A space with this slug already exists' });
  if (existingInquiry) throw makeError({ status: 409, message: 'An open request to update this space to this slug already exists' });
};

export const updateSpaceHandler: InquiryHandler<UpdateSpaceContent> = {
  sources: [{ sourceModel: InquiryResourceModel.Space, sourceSpaceId: 'spaceId' }],
  targets: [{ targetModel: InquiryResourceModel.admin }],
  contentSchema,
  resolutionInputSchema: baseResolutionInputSchema,
  resolutionSchema: baseResolutionInputSchema,
  validate,
  handleApprove: async (_db, _inquiry, _resolvedContent) => {
    // TODO: implement updateSpace approval
  },
  unique: true,
};
