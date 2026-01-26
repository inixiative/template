import { InquiryModelSchema } from '@template/db/zod/models';
import { readRoute } from '#/lib/requestTemplates';
import { Modules } from '#/modules/modules';

export const inquiryReceivedRoute = readRoute({
  model: Modules.inquiry,
  action: 'received',
  many: true,
  paginate: true,
  skipId: true,
  responseSchema: InquiryModelSchema,
  tags: ['Inquiries'],
});
