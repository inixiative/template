import { InquiryResourceModel } from '@template/db/generated/client/enums';
import { lensFor } from '@template/db/lens';
import { getResource } from '#/lib/context/getResource';
import { readRoute } from '#/lib/routeTemplates';
import { scopeNarrowing } from '#/middleware/resources/scopeNarrowing';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { inquiryPicks } from '#/modules/inquiry/schemas/inquiryPicks';
import { inquirySentResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { Modules } from '#/modules/modules';

export const spaceReadManyInquiriesSentRoute = readRoute({
  model: Modules.space,
  submodel: Modules.inquiry,
  action: 'sent',
  many: true,
  paginate: true,
  filterLens: {
    parent: lensFor('Inquiry'),
    root: {
      picks: inquiryPicks,
      where: { field: 'sourceModel', operator: 'equals', value: InquiryResourceModel.Space },
    },
  },
  responseSchema: inquirySentResponseSchema,
  middleware: [
    validatePermission('manage'),
    scopeNarrowing((c) => ({
      root: { where: { field: 'sourceSpaceId', operator: 'equals', value: getResource<'space'>(c).id } },
    })),
  ],
});
