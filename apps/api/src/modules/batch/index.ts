import { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '#/types/appEnv';

import { batchExecuteRoute } from '#/modules/batch/routes/batchExecute';
import { batchExecuteController } from '#/modules/batch/controllers/batchExecute';

export const batchRouter = new OpenAPIHono<AppEnv>();

batchRouter.openapi(batchExecuteRoute, batchExecuteController);
