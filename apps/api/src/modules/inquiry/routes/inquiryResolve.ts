import { z } from '@hono/zod-openapi';
import { InquiryModelSchema } from '@template/db/zod/models';
import { actionRoute } from '#/lib/requestTemplates';
import { Modules } from '#/modules/modules';

const bodySchema = z.object({
  outcome: z.enum(['approved', 'denied', 'canceled']),
  explanation: z.string().optional(),
});

export const inquiryResolveRoute = actionRoute({
  model: Modules.inquiry,
  action: 'resolve',
  method: 'post',
  bodySchema,
  responseSchema: InquiryModelSchema,
  tags: ['Inquiries'],
  description: 'Resolves an inquiry with an outcome.',
});
