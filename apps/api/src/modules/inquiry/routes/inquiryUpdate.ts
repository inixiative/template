import { InquiryModelSchema } from '@template/db/zod/models';
import { updateRoute } from '#/lib/requestTemplates';
import { Modules } from '#/modules/modules';

export const inquiryUpdateRoute = updateRoute({
  model: Modules.inquiry,
  bodySchema: InquiryModelSchema,
  responseSchema: InquiryModelSchema,
  tags: ['Inquiries'],
});
