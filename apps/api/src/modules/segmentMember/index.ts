import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import { validateActor } from '#/middleware/validations/validateActor';
import type { AppEnv } from '#/types/appEnv';

export const segmentMemberRouter = new OpenAPIHono<AppEnv>();

segmentMemberRouter.use('*', validateActor);

await autoRegisterRoutes(segmentMemberRouter, import.meta.dirname);
