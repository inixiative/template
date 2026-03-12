import { readRoute } from '#/lib/routeTemplates';
import { inquiryResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { Modules } from '#/modules/modules';

export const adminInquiryReadManyRoute = readRoute({
  model: Modules.inquiry,
  many: true,
  paginate: true,
  admin: true,
  responseSchema: inquiryResponseSchema,
});
