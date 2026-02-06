import { z } from '@hono/zod-openapi';
import { actionRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { batchExecutionStrategyEnum, batchStatusEnum } from '#/modules/batch/constants';

const batchRequestSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  path: z.string(),
  body: z.any().optional(),
  headers: z.record(z.string()).optional(),
});

const batchExecuteBodySchema = z.object({
  requests: z.array(z.array(batchRequestSchema)).max(10, 'Maximum 10 rounds allowed'),
  strategy: z.enum(batchExecutionStrategyEnum).default('allowFailures'),
  headers: z.record(z.string()).optional(),
});

const batchResultSchema = z.object({
  status: z.number(),
  body: z.any(),
  error: z.string().optional(),
});

const batchExecuteResponseSchema = z.object({
  batch: z.array(z.array(batchResultSchema)),
  summary: z.object({
    totalRounds: z.number(),
    completedRounds: z.number(),
    totalRequests: z.number(),
    successfulRequests: z.number(),
    failedRequests: z.number(),
    strategy: z.string(),
    status: z.enum(batchStatusEnum),
  }),
});

export const batchExecuteRoute = actionRoute({
  model: Modules.batch,
  action: 'execute',
  skipId: true,
  bodySchema: batchExecuteBodySchema,
  responseSchema: batchExecuteResponseSchema,
  description: 'Execute multiple API requests in batches with interpolation support',
});
