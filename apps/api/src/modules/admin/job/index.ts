import { OpenAPIHono } from '@hono/zod-openapi';
import { toOpenApi } from '#/lib/routeTemplates/utils';
import { jobEnqueueController } from '#/modules/admin/job/controllers/jobEnqueue';

import { jobEnqueueRoute } from '#/modules/admin/job/routes/jobEnqueue';
import type { AppEnv } from '#/types/appEnv';

export const adminJobRouter = new OpenAPIHono<AppEnv>();

adminJobRouter.openapi(toOpenApi(jobEnqueueRoute), jobEnqueueController);
