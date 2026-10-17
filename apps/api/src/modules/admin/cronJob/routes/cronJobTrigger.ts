/**
 * @atlas
 * @kind route
 * @partOf feature:cronJob, superadmin
 * @uses primitive:routeTemplates
 */
import { z } from '@hono/zod-openapi';
import { JobLane } from '#/jobs/types';
import { actionRoute } from '#/lib/routeTemplates/action';
import { Modules } from '#/modules/modules';

const CronJobTriggerBodySchema = z.object({
  lane: z.enum(Object.values(JobLane) as [JobLane, ...JobLane[]]).optional(),
});

export const cronJobTriggerRoute = actionRoute({
  model: Modules.cronJob,
  action: 'trigger',
  method: 'post',
  admin: true,
  bodySchema: CronJobTriggerBodySchema,
  bodyRequired: false,
});

export type CronJobTriggerBody = z.infer<typeof CronJobTriggerBodySchema>;
