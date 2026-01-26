import { CronJobModelSchema } from '@template/db/zod/models';
import { readRoute } from '#/lib/requestTemplates/read';
import { Modules } from '#/modules/modules';

export const cronJobReadManyRoute = readRoute({
  model: Modules.cronJob,
  many: true,
  admin: true,
  responseSchema: CronJobModelSchema,
});
