import { createRoute } from '#/lib/routeTemplates';
import { inquiryCreateBodySchema, inquiryCreateSanitizeKeys } from '#/modules/inquiry/schemas/inquiryCreateBodySchema';
import { inquirySentResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const spaceCreateInquiryRoute = createRoute({
  model: Modules.space,
  submodel: Modules.inquiry,
  bodySchema: inquiryCreateBodySchema,
  responseSchema: inquirySentResponseSchema,
  sanitizeKeys: inquiryCreateSanitizeKeys,
  tags: [Tags.space, Tags.inquiry],
});
