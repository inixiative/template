import { actionRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { inquirySentResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { Modules } from '#/modules/modules';

export const inquirySendRoute = actionRoute({
  model: Modules.inquiry,
  action: 'send',
  method: 'post',
  responseSchema: inquirySentResponseSchema,
  description: 'Sends a draft inquiry to the target.',
  middleware: [validatePermission('send')],
});
