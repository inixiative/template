import { CronJobScalarInputSchema, CronJobScalarSchema } from '@template/db';
import { updateRoute } from '#/lib/routeTemplates/update';
import { Modules } from '#/modules/modules';

export const cronJobUpdateRoute = updateRoute({
  model: Modules.cronJob,
  admin: true,
  bodySchema: CronJobScalarInputSchema.partial(),
  responseSchema: CronJobScalarSchema,
});
