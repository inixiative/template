import { CronJobScalarSchema } from '@template/db';
import { updateRoute } from '#/lib/requestTemplates/update';
import { Modules } from '#/modules/modules';

export const cronJobUpdateRoute = updateRoute({
  model: Modules.cronJob,
  admin: true,
  bodySchema: CronJobScalarSchema.partial(),
  responseSchema: CronJobScalarSchema,
});
