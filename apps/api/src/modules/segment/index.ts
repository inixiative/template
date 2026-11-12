import { OpenAPIHono } from '@hono/zod-openapi';
import { toOpenApi } from '#/lib/routeTemplates/utils';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import { segmentInfoController } from '#/modules/segment/controllers/segmentInfo';
import { segmentInfoRoute } from '#/modules/segment/routes/segmentInfo';
import type { AppEnv } from '#/types/appEnv';

export const segmentRouter = new OpenAPIHono<AppEnv>();

segmentRouter.openapi(toOpenApi(segmentInfoRoute), segmentInfoController);

await autoRegisterRoutes(segmentRouter, import.meta.dirname);
