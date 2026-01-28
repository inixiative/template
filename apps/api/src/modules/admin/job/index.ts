import { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '#/types/appEnv';

import { jobEnqueueRoute } from '#/modules/admin/job/routes/jobEnqueue';
import { jobEnqueueController } from '#/modules/admin/job/controllers/jobEnqueue';

export const adminJobRouter = new OpenAPIHono<AppEnv>();

adminJobRouter.openapi(jobEnqueueRoute, jobEnqueueController);
