/**
 * @atlas
 * @kind route
 * @partOf feature:inquiry, superadmin
 * @uses primitive:routeTemplates
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { inquiryResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { Modules } from '#/modules/modules';

export const adminInquiryReadManyRoute = readRoute({
  model: Modules.inquiry,
  many: true,
  paginate: true,
  admin: true,
  filterLens: { parent: lensFor('Inquiry') },
  responseSchema: inquiryResponseSchema,
});
