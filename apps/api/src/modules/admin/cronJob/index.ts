import { OpenAPIHono } from '@hono/zod-openapi';
import { toOpenApi } from '#/lib/routeTemplates/utils';
import { cronJobCreateController } from '#/modules/admin/cronJob/controllers/cronJobCreate';
import { cronJobDeleteController } from '#/modules/admin/cronJob/controllers/cronJobDelete';
import { cronJobReadController } from '#/modules/admin/cronJob/controllers/cronJobRead';
import { cronJobReadManyController } from '#/modules/admin/cronJob/controllers/cronJobReadMany';
import { cronJobTriggerController } from '#/modules/admin/cronJob/controllers/cronJobTrigger';
import { cronJobUpdateController } from '#/modules/admin/cronJob/controllers/cronJobUpdate';
import { cronJobCreateRoute } from '#/modules/admin/cronJob/routes/cronJobCreate';
import { cronJobDeleteRoute } from '#/modules/admin/cronJob/routes/cronJobDelete';
import { cronJobReadRoute } from '#/modules/admin/cronJob/routes/cronJobRead';
import { cronJobReadManyRoute } from '#/modules/admin/cronJob/routes/cronJobReadMany';
import { cronJobTriggerRoute } from '#/modules/admin/cronJob/routes/cronJobTrigger';
import { cronJobUpdateRoute } from '#/modules/admin/cronJob/routes/cronJobUpdate';
import type { AppEnv } from '#/types/appEnv';

export const adminCronJobRouter = new OpenAPIHono<AppEnv>();

adminCronJobRouter.openapi(toOpenApi(cronJobReadManyRoute), cronJobReadManyController);
adminCronJobRouter.openapi(toOpenApi(cronJobCreateRoute), cronJobCreateController);
adminCronJobRouter.openapi(toOpenApi(cronJobReadRoute), cronJobReadController);
adminCronJobRouter.openapi(toOpenApi(cronJobUpdateRoute), cronJobUpdateController);
adminCronJobRouter.openapi(toOpenApi(cronJobDeleteRoute), cronJobDeleteController);
adminCronJobRouter.openapi(toOpenApi(cronJobTriggerRoute), cronJobTriggerController);
