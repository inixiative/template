import { z } from '@hono/zod-openapi';
import { InquiryModelSchema } from '@template/db/zod/models';
import { actionRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

const bodySchema = z.object({
  explanation: z.string(),
});

export const inquiryRequestChangesRoute = actionRoute({
  model: Modules.inquiry,
  action: 'request-changes',
  method: 'post',
  bodySchema,
  responseSchema: InquiryModelSchema,
  tags: ['Inquiries'],
  description: 'Requests changes from the source before the inquiry can be resolved.',
});
