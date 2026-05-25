import { InquiryResourceModel, InquiryStatus } from '@template/db/generated/client/enums';
import { getResource } from '#/lib/context/getResource';
import { readRoute } from '#/lib/routeTemplates';
import { scopeNarrowing } from '#/middleware/resources/scopeNarrowing';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { inquiryNarrowing } from '#/modules/inquiry/schemas/inquiryNarrowing';
import { inquiryReceivedResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { Modules } from '#/modules/modules';

export const organizationReadManyInquiriesReceivedRoute = readRoute({
  model: Modules.organization,
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
          { field: 'targetModel', operator: 'equals', value: InquiryResourceModel.Organization },
          { field: 'targetOrganizationId', operator: 'equals', value: getResource<'organization'>(c).id },
          { field: 'status', operator: 'notEquals', value: InquiryStatus.draft },
        ],
      },
    })),
  ],
});
