/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:inquiry
 */
import { createRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import {
  inquiryCreateBodySchema,
  inquiryCreateServerOwnedKeys,
} from '#/modules/inquiry/schemas/inquiryCreateBodySchema';
import { inquiryResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { Modules } from '#/modules/modules';
import { OpenApiTags } from '#/modules/openApiTags';

export const meCreateInquiryRoute = createRoute({
  model: Modules.me,
  middleware: [validatePermission('operate')],
  submodel: Modules.inquiry,
  skipId: true,
  bodySchema: inquiryCreateBodySchema,
  responseSchema: inquiryResponseSchema,
  sanitizeKeys: inquiryCreateServerOwnedKeys,
  tags: [OpenApiTags.me, OpenApiTags.inquiry],
});
