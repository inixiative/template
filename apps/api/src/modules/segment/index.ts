import { OpenAPIHono } from '@hono/zod-openapi';
import { toOpenApi } from '#/lib/routeTemplates/utils';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import { validateActor } from '#/middleware/validations/validateActor';
import { segmentInfoController } from '#/modules/segment/controllers/segmentInfo';
import { segmentInfoRoute } from '#/modules/segment/routes/segmentInfo';
import type { AppEnv } from '#/types/appEnv';

export const segmentRouter = new OpenAPIHono<AppEnv>();

segmentRouter.openapi(toOpenApi(segmentInfoRoute), segmentInfoController);

segmentRouter.use('*', validateActor);

await autoRegisterRoutes(segmentRouter, import.meta.dirname);
