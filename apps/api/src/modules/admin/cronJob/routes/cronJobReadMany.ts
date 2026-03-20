import { CronJobScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates/read';
import { Modules } from '#/modules/modules';

export const cronJobReadManyRoute = readRoute({
  model: Modules.cronJob,
  many: true,
  admin: true,
  responseSchema: CronJobScalarSchema,
});
