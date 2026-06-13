/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 */
import { InquiryStatus } from '@template/db/generated/client/enums';
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { inquiryPicks } from '#/modules/inquiry/schemas/inquiryPicks';
import { inquiryReceivedResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { Modules } from '#/modules/modules';

export const spaceReadManyInquiriesReceivedRoute = readRoute({
  model: Modules.space,
  submodel: Modules.inquiry,
  action: 'received',
  many: true,
  paginate: true,
  filterLens: {
    parent: lensFor('Inquiry'),
    root: {
      picks: inquiryPicks,
      enumOmits: { status: [InquiryStatus.draft, InquiryStatus.canceled] },
    },
  },
  responseSchema: inquiryReceivedResponseSchema,
  middleware: [validatePermission('manage')],
});
