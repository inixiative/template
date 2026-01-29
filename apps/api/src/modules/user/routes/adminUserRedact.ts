import { actionRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const adminUserRedactRoute = actionRoute({
  model: Modules.user,
  action: 'redact',
  admin: true,
  description: 'Permanently redacts user data (GDPR right to be forgotten)',
});
