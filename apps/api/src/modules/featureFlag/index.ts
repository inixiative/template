import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import { validateActor } from '#/middleware/validations/validateActor';
import type { AppEnv } from '#/types/appEnv';

export const featureFlagRouter = new OpenAPIHono<AppEnv>();

featureFlagRouter.use('*', validateActor);

await autoRegisterRoutes(featureFlagRouter, import.meta.dirname);
