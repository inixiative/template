import { OpenAPIHono } from '@hono/zod-openapi';
import { toOpenApi } from '#/lib/routeTemplates/utils';
import { segmentCreateController } from '#/modules/admin/segment/controllers/segmentCreate';
import { segmentReachController } from '#/modules/admin/segment/controllers/segmentReach';
import { segmentReadManyController } from '#/modules/admin/segment/controllers/segmentReadMany';
import { segmentCreateRoute } from '#/modules/admin/segment/routes/segmentCreate';
import { segmentReachRoute } from '#/modules/admin/segment/routes/segmentReach';
import { segmentReadManyRoute } from '#/modules/admin/segment/routes/segmentReadMany';
import type { AppEnv } from '#/types/appEnv';

export const adminSegmentRouter = new OpenAPIHono<AppEnv>();

adminSegmentRouter.openapi(toOpenApi(segmentReadManyRoute), segmentReadManyController);
adminSegmentRouter.openapi(toOpenApi(segmentCreateRoute), segmentCreateController);
adminSegmentRouter.openapi(toOpenApi(segmentReachRoute), segmentReachController);
