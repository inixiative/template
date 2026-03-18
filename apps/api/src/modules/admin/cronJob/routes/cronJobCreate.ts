import { CronJobScalarInputSchema, CronJobScalarSchema } from '@template/db';
import { createRoute } from '#/lib/routeTemplates/create';
import { Modules } from '#/modules/modules';

export const cronJobCreateRoute = createRoute({
  model: Modules.cronJob,
  admin: true,
  bodySchema: CronJobScalarInputSchema,
  responseSchema: CronJobScalarSchema,
});
