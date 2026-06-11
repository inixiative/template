/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, feature:inquiry
 */
import { InquiryResourceModel, InquiryStatus } from '@template/db/generated/client/enums';
import { lensFor } from '@template/db/lens';
import { getResource } from '#/lib/context/getResource';
import { readRoute } from '#/lib/routeTemplates';
import { scopeNarrowing } from '#/middleware/resources/scopeNarrowing';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { inquiryPicks } from '#/modules/inquiry/schemas/inquiryPicks';
import { inquiryReceivedResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { Modules } from '#/modules/modules';

export const organizationReadManyInquiriesReceivedRoute = readRoute({
  model: Modules.organization,
  submodel: Modules.inquiry,
  action: 'received',
  many: true,
  paginate: true,
  filterLens: {
    parent: lensFor('Inquiry'),
    root: {
      picks: inquiryPicks,
      enumOmits: { InquiryStatus: [InquiryStatus.draft, InquiryStatus.canceled] },
      where: {
        all: [
          { field: 'targetModel', operator: 'equals', value: InquiryResourceModel.Organization },
          { field: 'status', operator: 'notIn', value: [InquiryStatus.draft, InquiryStatus.canceled] },
        ],
      },
    },
  },
  responseSchema: inquiryReceivedResponseSchema,
  middleware: [
    validatePermission('manage'),
    scopeNarrowing((c) => ({
      root: {
        where: { field: 'targetOrganizationId', operator: 'equals', value: getResource<'organization'>(c).id },
      },
    })),
  ],
});
