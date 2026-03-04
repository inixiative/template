import { InquiryScalarSchema } from '@template/db';
import { createRoute } from '#/lib/routeTemplates';
import { inquiryCreateBodySchema, INQUIRY_CREATE_SANITIZE_KEYS } from '#/modules/inquiry/schemas/inquiryCreateBodySchema';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const meCreateInquiryRoute = createRoute({
  model: Modules.me,
  submodel: Modules.inquiry,
  skipId: true,
  bodySchema: inquiryCreateBodySchema,
  responseSchema: InquiryScalarSchema,
  sanitizeKeys: INQUIRY_CREATE_SANITIZE_KEYS,
  tags: [Tags.me, Tags.inquiry],
});
