/**
 * @atlas
 * @kind route
 * @partOf primitive:jobs, superadmin
 * @uses primitive:routeTemplates, primitive:jobs
 */
import { z } from '@hono/zod-openapi';
import { JobHandlerName } from '#/jobs/handlers';
import { SLOW_LANE_PRIORITY } from '#/jobs/lanePriority';
import { JobLane } from '#/jobs/types';
import { createRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

const handlerNames = Object.values(JobHandlerName) as [string, ...string[]];

const JobEnqueueBodySchema = z.object({
  handler: z.enum(handlerNames),
  payload: z.record(z.string(), z.unknown()).optional(),
  options: z
    .object({
      // The band between the lanes: no priority is the fast lane, SLOW_LANE_PRIORITY is reserved for lane: slow.
      priority: z
        .number()
        .int()
        .min(0)
        .max(SLOW_LANE_PRIORITY - 1)
        .optional(),
      delay: z.number().optional(),
      attempts: z.number().optional(),
      backoff: z.number().optional(),
      lane: z.enum(Object.values(JobLane) as [JobLane, ...JobLane[]]).optional(),
    })
    .optional(),
});

const JobEnqueueResponseSchema = z.object({
  jobId: z.string().nullable(),
  name: z.string(),
  enqueuedAt: z.string(),
});

export const jobEnqueueRoute = createRoute({
  model: Modules.job,
  admin: true,
  description: 'Enqueue an ad-hoc background job',
  bodySchema: JobEnqueueBodySchema,
  responseSchema: JobEnqueueResponseSchema,
});

export type JobEnqueueBody = z.infer<typeof JobEnqueueBodySchema>;
export type JobEnqueueResponse = z.infer<typeof JobEnqueueResponseSchema>;
