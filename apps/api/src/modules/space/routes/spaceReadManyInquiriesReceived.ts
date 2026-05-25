import { InquiryResourceModel, InquiryStatus } from '@template/db/generated/client/enums';
import { getResource } from '#/lib/context/getResource';
import { readRoute } from '#/lib/routeTemplates';
import { scopeNarrowing } from '#/middleware/resources/scopeNarrowing';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { inquiryNarrowing } from '#/modules/inquiry/schemas/inquiryNarrowing';
import { inquiryReceivedResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { Modules } from '#/modules/modules';

export const spaceReadManyInquiriesReceivedRoute = readRoute({
  model: Modules.space,
  submodel: Modules.inquiry,
  action: 'received',
  many: true,
  paginate: true,
  narrowing: inquiryNarrowing,
  responseSchema: inquiryReceivedResponseSchema,
  middleware: [
    validatePermission('manage'),
    scopeNarrowing((c) => ({
      where: {
        all: [
          { field: 'targetModel', operator: 'equals', value: InquiryResourceModel.Space },
          { field: 'targetSpaceId', operator: 'equals', value: getResource<'space'>(c).id },
          { field: 'status', operator: 'notEquals', value: InquiryStatus.draft },
        ],
      },
    })),
  ],
});
