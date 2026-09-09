import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import { validateActor } from '#/middleware/validations/validateActor';
import type { AppEnv } from '#/types/appEnv';

export const segmentRouter = new OpenAPIHono<AppEnv>();

segmentRouter.use('*', validateActor);

await autoRegisterRoutes(segmentRouter, import.meta.dirname);
