import { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '#/types/appEnv';

import { cronJobCreateRoute } from '#/modules/admin/cronJob/routes/cronJobCreate';
import { cronJobDeleteRoute } from '#/modules/admin/cronJob/routes/cronJobDelete';
import { cronJobReadRoute } from '#/modules/admin/cronJob/routes/cronJobRead';
import { cronJobReadManyRoute } from '#/modules/admin/cronJob/routes/cronJobReadMany';
import { cronJobTriggerRoute } from '#/modules/admin/cronJob/routes/cronJobTrigger';
import { cronJobUpdateRoute } from '#/modules/admin/cronJob/routes/cronJobUpdate';

import { cronJobCreateController } from '#/modules/admin/cronJob/controllers/cronJobCreate';
import { cronJobDeleteController } from '#/modules/admin/cronJob/controllers/cronJobDelete';
import { cronJobReadController } from '#/modules/admin/cronJob/controllers/cronJobRead';
import { cronJobReadManyController } from '#/modules/admin/cronJob/controllers/cronJobReadMany';
import { cronJobTriggerController } from '#/modules/admin/cronJob/controllers/cronJobTrigger';
import { cronJobUpdateController } from '#/modules/admin/cronJob/controllers/cronJobUpdate';

export const cronJobRouter = new OpenAPIHono<AppEnv>();

cronJobRouter.openapi(cronJobReadManyRoute, cronJobReadManyController);
cronJobRouter.openapi(cronJobCreateRoute, cronJobCreateController);
cronJobRouter.openapi(cronJobReadRoute, cronJobReadController);
cronJobRouter.openapi(cronJobUpdateRoute, cronJobUpdateController);
cronJobRouter.openapi(cronJobDeleteRoute, cronJobDeleteController);
cronJobRouter.openapi(cronJobTriggerRoute, cronJobTriggerController);
