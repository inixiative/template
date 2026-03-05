import { createRoute } from '#/lib/routeTemplates';
import { inquiryCreateBodySchema, inquiryCreateSanitizeKeys } from '#/modules/inquiry/schemas/inquiryCreateBodySchema';
import { inquirySentResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const organizationCreateInquiryRoute = createRoute({
  model: Modules.organization,
  submodel: Modules.inquiry,
  bodySchema: inquiryCreateBodySchema,
  responseSchema: inquirySentResponseSchema,
  sanitizeKeys: inquiryCreateSanitizeKeys,
  tags: [Tags.organization, Tags.inquiry],
});
