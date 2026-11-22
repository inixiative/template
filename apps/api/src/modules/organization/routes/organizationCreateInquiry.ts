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

export const organizationCreateInquiryRoute = createRoute({
  model: Modules.organization,
  submodel: Modules.inquiry,
  bodySchema: inquiryCreateBodySchema,
  responseSchema: inquiryResponseSchema,
  sanitizeKeys: inquiryCreateServerOwnedKeys,
  tags: [OpenApiTags.organization, OpenApiTags.inquiry],
});
