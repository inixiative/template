/**
 * @atlas
 * @kind route
 * @partOf feature:inquiry
 * @uses primitive:routeTemplates
 */
import { deleteRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { inquiryVersionSchema } from '#/modules/inquiry/schemas/inquiryVersionSchema';
import { Modules } from '#/modules/modules';

export const inquiryCancelRoute = deleteRoute({
  model: Modules.inquiry,
  action: 'cancel',
  query: inquiryVersionSchema,
  description: 'Cancels an inquiry. Only the source can cancel.',
  middleware: [validatePermission('send')],
});
