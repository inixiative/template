/**
 * @atlas
 * @kind route
 * @partOf feature:users
 */
import { InquiryStatus } from '@template/db/generated/client/enums';
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { inquiryPicks } from '#/modules/inquiry/schemas/inquiryPicks';
import { inquiryReceivedResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { Modules } from '#/modules/modules';

export const meReadManyInquiriesReceivedRoute = readRoute({
  model: Modules.me,
  submodel: Modules.inquiry,
  action: 'received',
  many: true,
  skipId: true,
  paginate: true,
  filterLens: {
    parent: lensFor('Inquiry'),
    root: {
      picks: inquiryPicks,
      enumOmits: { status: [InquiryStatus.draft, InquiryStatus.canceled] },
    },
  },
  responseSchema: inquiryReceivedResponseSchema,
});
