import { InquiryModelSchema } from '@template/db/zod/models';
import { actionRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const inquirySendRoute = actionRoute({
  model: Modules.inquiry,
  action: 'send',
  method: 'post',
  responseSchema: InquiryModelSchema,
  tags: ['Inquiries'],
  description: 'Sends a draft inquiry to the target.',
});
