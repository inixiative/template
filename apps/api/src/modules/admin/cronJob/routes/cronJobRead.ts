/**
 * @atlas
 * @kind route
 * @partOf feature:cronJob, superadmin
 * @uses primitive:routeTemplates
 */
import { CronJobScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates/read';
import { Modules } from '#/modules/modules';

export const cronJobReadRoute = readRoute({
  model: Modules.cronJob,
  admin: true,
  responseSchema: CronJobScalarSchema,
});
