import { z } from '@hono/zod-openapi';
import { JobHandlerName } from '#/jobs/handlers';
import { createRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

const handlerNames = Object.values(JobHandlerName) as [string, ...string[]];

const JobEnqueueBodySchema = z.object({
  handler: z.enum(handlerNames),
  payload: z.record(z.string(), z.unknown()).optional(),
  options: z
    .object({
      priority: z.number().optional(),
      delay: z.number().optional(),
      attempts: z.number().optional(),
      backoff: z.number().optional(),
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
