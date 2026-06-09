import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
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
    root: { picks: inquiryPicks },
  },
  responseSchema: inquirySentResponseSchema,
  middleware: [validatePermission('manage')],
});
