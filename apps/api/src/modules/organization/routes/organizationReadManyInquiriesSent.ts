import { InquiryResourceModel } from '@template/db/generated/client/enums';
import { getResource } from '#/lib/context/getResource';
import { readRoute } from '#/lib/routeTemplates';
import { scopeNarrowing } from '#/middleware/resources/scopeNarrowing';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { inquiryNarrowing } from '#/modules/inquiry/schemas/inquiryNarrowing';
import { inquirySentResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { Modules } from '#/modules/modules';

export const organizationReadManyInquiriesSentRoute = readRoute({
  model: Modules.organization,
  submodel: Modules.inquiry,
  action: 'sent',
  many: true,
  paginate: true,
  narrowing: inquiryNarrowing,
  responseSchema: inquirySentResponseSchema,
  middleware: [
    validatePermission('manage'),
    scopeNarrowing((c) => ({
      where: {
        all: [
          { field: 'sourceModel', operator: 'equals', value: InquiryResourceModel.Organization },
          { field: 'sourceOrganizationId', operator: 'equals', value: getResource<'organization'>(c).id },
        ],
      },
    })),
  ],
});
