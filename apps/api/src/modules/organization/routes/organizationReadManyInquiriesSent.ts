import { InquiryResourceModel } from '@template/db/generated/client/enums';
import { lensFor } from '@template/db/lens';
import { getResource } from '#/lib/context/getResource';
import { readRoute } from '#/lib/routeTemplates';
import { scopeNarrowing } from '#/middleware/resources/scopeNarrowing';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { inquiryPicks } from '#/modules/inquiry/schemas/inquiryPicks';
import { inquirySentResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { Modules } from '#/modules/modules';

export const organizationReadManyInquiriesSentRoute = readRoute({
  model: Modules.organization,
  submodel: Modules.inquiry,
  action: 'sent',
  many: true,
  paginate: true,
  filterLens: {
    parent: lensFor('Inquiry'),
    root: {
      picks: inquiryPicks,
      where: { field: 'sourceModel', operator: 'equals', value: InquiryResourceModel.Organization },
    },
  },
  responseSchema: inquirySentResponseSchema,
  middleware: [
    validatePermission('manage'),
    scopeNarrowing((c) => ({
      root: {
        where: { field: 'sourceOrganizationId', operator: 'equals', value: getResource<'organization'>(c).id },
      },
    })),
  ],
});
