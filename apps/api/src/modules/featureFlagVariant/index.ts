import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import { validateActor } from '#/middleware/validations/validateActor';
import type { AppEnv } from '#/types/appEnv';

export const featureFlagVariantRouter = new OpenAPIHono<AppEnv>();

featureFlagVariantRouter.use('*', validateActor);

await autoRegisterRoutes(featureFlagVariantRouter, import.meta.dirname);
