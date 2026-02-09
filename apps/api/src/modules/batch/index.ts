import { OpenAPIHono } from '@hono/zod-openapi';
import { batchExecuteController } from '#/modules/batch/controllers/batchExecute';

import { batchExecuteRoute } from '#/modules/batch/routes/batchExecute';
import type { AppEnv } from '#/types/appEnv';

export const batchRouter = new OpenAPIHono<AppEnv>();

batchRouter.openapi(batchExecuteRoute, batchExecuteController);
