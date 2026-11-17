/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, feature:inquiry
 */
import { createRoute } from '#/lib/routeTemplates';
import {
  inquiryCreateBodySchema,
  inquiryCreateSanitizeKeys,
} from '#/modules/inquiry/schemas/inquiryCreateBodySchema';
import { inquiryResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const spaceCreateInquiryRoute = createRoute({
  model: Modules.space,
  submodel: Modules.inquiry,
  bodySchema: inquiryCreateBodySchema,
  responseSchema: inquiryResponseSchema,
  sanitizeKeys: inquiryCreateSanitizeKeys,
  tags: [Tags.space, Tags.inquiry],
});
