import { createRoute } from '#/lib/routeTemplates';
import { inquiryCreateBodySchema, inquiryCreateSanitizeKeys } from '#/modules/inquiry/schemas/inquiryCreateBodySchema';
import { inquirySentResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { Modules } from '#/modules/modules';

export const adminInquiryCreateRoute = createRoute({
  model: Modules.inquiry,
  admin: true,
  bodySchema: inquiryCreateBodySchema,
  responseSchema: inquirySentResponseSchema,
  sanitizeKeys: inquiryCreateSanitizeKeys,
});
