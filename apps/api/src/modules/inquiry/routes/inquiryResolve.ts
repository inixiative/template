import { z } from '@hono/zod-openapi';
import { InquiryModelSchema } from '@template/db/zod/models';
import { actionRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

const bodySchema = z.object({
  outcome: z.enum(['approved', 'denied']),
  explanation: z.string().optional(),
});

export const inquiryResolveRoute = actionRoute({
  model: Modules.inquiry,
  action: 'resolve',
  method: 'post',
  bodySchema,
  responseSchema: InquiryModelSchema,
  tags: ['Inquiries'],
  description: 'Resolves an inquiry as approved or denied.',
  middleware: [validatePermission('resolve')],
});
