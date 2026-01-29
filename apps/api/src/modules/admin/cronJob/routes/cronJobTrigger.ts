import { actionRoute } from '#/lib/routeTemplates/action';
import { Modules } from '#/modules/modules';

export const cronJobTriggerRoute = actionRoute({
  model: Modules.cronJob,
  action: 'trigger',
  method: 'post',
  admin: true,
});
