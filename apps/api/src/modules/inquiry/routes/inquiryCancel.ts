import { deleteRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const inquiryCancelRoute = deleteRoute({
  model: Modules.inquiry,
  tags: ['Inquiries'],
  description: 'Cancels an inquiry. Only the source can cancel.',
});
