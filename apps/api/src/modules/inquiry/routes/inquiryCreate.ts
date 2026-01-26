import { InquiryModelSchema } from '@template/db/zod/models';
import { createRoute } from '#/lib/requestTemplates';
import { Modules } from '#/modules/modules';

export const inquiryCreateRoute = createRoute({
  model: Modules.inquiry,
  bodySchema: InquiryModelSchema,
  responseSchema: InquiryModelSchema,
  tags: ['Inquiries'],
});
