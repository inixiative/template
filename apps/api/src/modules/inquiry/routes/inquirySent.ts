import { InquiryModelSchema } from '@template/db/zod/models';
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const inquirySentRoute = readRoute({
  model: Modules.inquiry,
  action: 'sent',
  many: true,
  paginate: true,
  skipId: true,
  responseSchema: InquiryModelSchema,
  tags: ['Inquiries'],
});
