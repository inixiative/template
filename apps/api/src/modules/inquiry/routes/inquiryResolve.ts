import { z } from '@hono/zod-openapi';
import { InquiryModelSchema } from '@template/db/zod/models';
import { InquiryStatus } from '@template/db/generated/client/enums';
import { actionRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
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
  responseSchema: InquiryModelSchema,
  description: 'Resolves an inquiry: approve, deny, or request changes from the source.',
  middleware: [validatePermission('resolve')],
});
