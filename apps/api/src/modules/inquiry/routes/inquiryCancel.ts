import { deleteRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const inquiryCancelRoute = deleteRoute({
  model: Modules.inquiry,
  tags: ['Inquiries'],
  description: 'Cancels an inquiry. Only the source can cancel.',
  middleware: [validatePermission('cancel')],
});
