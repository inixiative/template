/**
 * @atlas
 * @kind route
 * @partOf feature:users
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { validateSelfPermission } from '#/middleware/validations/validateSelfPermission';
import { inquiryPicks } from '#/modules/inquiry/schemas/inquiryPicks';
import { inquirySentResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { Modules } from '#/modules/modules';

export const meReadManyInquiriesSentRoute = readRoute({
  model: Modules.me,
  middleware: [validateSelfPermission('read')],
  submodel: Modules.inquiry,
  action: 'sent',
  many: true,
  skipId: true,
  paginate: true,
  filterLens: {
    parent: lensFor('Inquiry'),
    root: { picks: inquiryPicks },
  },
  responseSchema: inquirySentResponseSchema,
});
