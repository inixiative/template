import { InquiryScalarSchema } from '@template/db';
import { updateRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const inquiryUpdateRoute = updateRoute({
  model: Modules.inquiry,
  bodySchema: InquiryScalarSchema,
  responseSchema: InquiryScalarSchema,
  tags: ['Inquiries'],
});
