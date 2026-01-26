import { deleteRoute } from '#/lib/requestTemplates/delete';
import { Modules } from '#/modules/modules';

export const cronJobDeleteRoute = deleteRoute({
  model: Modules.cronJob,
  admin: true,
});
