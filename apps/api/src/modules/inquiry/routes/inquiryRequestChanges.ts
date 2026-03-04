import { z } from '@hono/zod-openapi';
import { InquiryModelSchema } from '@template/db/zod/models';
import { actionRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

const bodySchema = z.object({
  explanation: z.string(),
});

export const inquiryRequestChangesRoute = actionRoute({
  model: Modules.inquiry,
  action: 'requestChanges',
  method: 'post',
  bodySchema,
  responseSchema: InquiryModelSchema,
  tags: ['Inquiries'],
  description: 'Requests changes from the source before the inquiry can be resolved.',
  middleware: [validatePermission('requestChanges')],
});
