import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { inquiryResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { Modules } from '#/modules/modules';

export const inquiryReadRoute = readRoute({
  model: Modules.inquiry,
  responseSchema: inquiryResponseSchema,
  middleware: [validatePermission('read')],
});
