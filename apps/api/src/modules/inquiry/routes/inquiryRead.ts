import { InquiryModelSchema } from '@template/db/zod/models';
import { readRoute } from '#/lib/requestTemplates';
import { Modules } from '#/modules/modules';

export const inquiryReadRoute = readRoute({
  model: Modules.inquiry,
  responseSchema: InquiryModelSchema,
  tags: ['Inquiries'],
});
