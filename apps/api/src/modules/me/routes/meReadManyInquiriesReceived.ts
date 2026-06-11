/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:inquiry
 */
import { InquiryResourceModel, InquiryStatus } from '@template/db/generated/client/enums';
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { scopeNarrowing } from '#/middleware/resources/scopeNarrowing';
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
      enumOmits: { InquiryStatus: [InquiryStatus.draft, InquiryStatus.canceled] },
      where: {
        all: [
          { field: 'targetModel', operator: 'equals', value: InquiryResourceModel.User },
          { field: 'status', operator: 'notIn', value: [InquiryStatus.draft, InquiryStatus.canceled] },
        ],
      },
    },
  },
  responseSchema: inquiryReceivedResponseSchema,
  middleware: [
    scopeNarrowing((c) => ({
      root: { where: { field: 'targetUserId', operator: 'equals', value: c.get('user')!.id } },
    })),
  ],
});
