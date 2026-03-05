import { z } from '@hono/zod-openapi';
import { InquiryScalarSchema } from '@template/db';
import { InquiryStatus } from '@template/db/generated/client/enums';
import { updateRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

const bodySchema = z.object({
  content: z.record(z.string(), z.unknown()).optional(),
  status: z.enum([InquiryStatus.draft, InquiryStatus.sent]).optional(),
});

export const inquiryUpdateRoute = updateRoute({
  model: Modules.inquiry,
  bodySchema,
  responseSchema: InquiryScalarSchema,
  middleware: [validatePermission('send')],
});
