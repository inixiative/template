import { CronJobModelSchema } from '@template/db/zod/models';
import { readRoute } from '#/lib/requestTemplates/read';
import { Modules } from '#/modules/modules';

export const cronJobReadRoute = readRoute({
  model: Modules.cronJob,
  admin: true,
  responseSchema: CronJobModelSchema,
});
