/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, feature:inquiry
 */
import { createRoute } from '#/lib/routeTemplates';
import {
  inquiryCreateBodySchema,
  inquiryCreateServerOwnedKeys,
} from '#/modules/inquiry/schemas/inquiryCreateBodySchema';
import { inquiryResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { Modules } from '#/modules/modules';
import { OpenApiTags } from '#/modules/openApiTags';

export const spaceCreateInquiryRoute = createRoute({
  model: Modules.space,
  submodel: Modules.inquiry,
  bodySchema: inquiryCreateBodySchema,
  responseSchema: inquiryResponseSchema,
  sanitizeKeys: inquiryCreateServerOwnedKeys,
  tags: [OpenApiTags.space, OpenApiTags.inquiry],
});
