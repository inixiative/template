import { actionRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const meRedactRoute = actionRoute({
  model: Modules.me,
  action: 'redact',
  skipId: true,
  description: 'Permanently redacts your account data (GDPR right to be forgotten)',
  tags: [Tags.me, Tags.user],
});
