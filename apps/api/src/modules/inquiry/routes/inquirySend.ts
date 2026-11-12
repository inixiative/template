/**
 * @atlas
 * @kind route
 * @partOf feature:inquiry
 * @uses primitive:routeTemplates
 */
import { actionRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { inquirySentResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { inquiryVersionSchema } from '#/modules/inquiry/schemas/inquiryVersionSchema';
import { Modules } from '#/modules/modules';

export const inquirySendRoute = actionRoute({
  model: Modules.inquiry,
  action: 'send',
  method: 'post',
  bodySchema: inquiryVersionSchema,
  responseSchema: inquirySentResponseSchema,
  description: 'Sends a draft or changes-requested inquiry to the target; no-op if already sent.',
  middleware: [validatePermission('send')],
});
