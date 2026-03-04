import { InquiryScalarSchema } from '@template/db';
import { createRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { inquiryCreateBodySchema, INQUIRY_CREATE_SANITIZE_KEYS } from '#/modules/inquiry/schemas/inquiryCreateBodySchema';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const organizationCreateInquiryRoute = createRoute({
  model: Modules.organization,
  submodel: Modules.inquiry,
  bodySchema: inquiryCreateBodySchema,
  responseSchema: InquiryScalarSchema,
  sanitizeKeys: INQUIRY_CREATE_SANITIZE_KEYS,
  middleware: [validatePermission('manage')],
  tags: [Tags.organization, Tags.inquiry],
});
