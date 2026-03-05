import { InquiryScalarSchema } from '@template/db';
import { createRoute } from '#/lib/routeTemplates';
import { inquiryCreateBodySchema, inquiryCreateSanitizeKeys } from '#/modules/inquiry/schemas/inquiryCreateBodySchema';
import { Modules } from '#/modules/modules';

export const adminInquiryCreateRoute = createRoute({
  model: Modules.inquiry,
  admin: true,
  bodySchema: inquiryCreateBodySchema,
  responseSchema: InquiryScalarSchema,
  sanitizeKeys: inquiryCreateSanitizeKeys,
});
