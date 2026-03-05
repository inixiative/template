import { createRoute } from '#/lib/routeTemplates';
import { inquiryCreateBodySchema, inquiryCreateSanitizeKeys } from '#/modules/inquiry/schemas/inquiryCreateBodySchema';
import { inquirySentResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const meCreateInquiryRoute = createRoute({
  model: Modules.me,
  submodel: Modules.inquiry,
  skipId: true,
  bodySchema: inquiryCreateBodySchema,
  responseSchema: inquirySentResponseSchema,
  sanitizeKeys: inquiryCreateSanitizeKeys,
  tags: [Tags.me, Tags.inquiry],
});
