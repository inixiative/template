import { z } from '@hono/zod-openapi';
import { InquiryStatus } from '@template/db/generated/client/enums';
import { actionRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { inquiryResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { Modules } from '#/modules/modules';

const bodySchema = z.object({
  status: z.enum([InquiryStatus.approved, InquiryStatus.denied, InquiryStatus.changesRequested]),
  explanation: z.string().optional(),
});

export const inquiryResolveRoute = actionRoute({
  model: Modules.inquiry,
  action: 'resolve',
  method: 'post',
  bodySchema,
  responseSchema: inquiryResponseSchema,
  description: 'Resolves an inquiry: approve, deny, or request changes from the source.',
  middleware: [validatePermission('resolve')],
});
