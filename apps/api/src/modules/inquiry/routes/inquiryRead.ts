import { InquiryModelSchema } from '@template/db/zod/models';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const inquiryReadRoute = readRoute({
  model: Modules.inquiry,
  responseSchema: InquiryModelSchema,
  tags: ['Inquiries'],
  middleware: [validatePermission('read')],
});
