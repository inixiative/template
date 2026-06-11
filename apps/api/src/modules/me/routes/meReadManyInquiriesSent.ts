/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:inquiry
 */
import { InquiryResourceModel } from '@template/db/generated/client/enums';
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { scopeNarrowing } from '#/middleware/resources/scopeNarrowing';
import { inquiryPicks } from '#/modules/inquiry/schemas/inquiryPicks';
import { inquirySentResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { Modules } from '#/modules/modules';

export const meReadManyInquiriesSentRoute = readRoute({
  model: Modules.me,
  submodel: Modules.inquiry,
  action: 'sent',
  many: true,
  skipId: true,
  paginate: true,
  filterLens: {
    parent: lensFor('Inquiry'),
    root: {
      picks: inquiryPicks,
      where: { field: 'sourceModel', operator: 'equals', value: InquiryResourceModel.User },
    },
  },
  responseSchema: inquirySentResponseSchema,
  middleware: [
    scopeNarrowing((c) => ({
      root: { where: { field: 'sourceUserId', operator: 'equals', value: c.get('user')!.id } },
    })),
  ],
});
