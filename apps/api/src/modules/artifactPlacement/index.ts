import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import { validateActor } from '#/middleware/validations/validateActor';
import type { AppEnv } from '#/types/appEnv';

export const artifactPlacementRouter = new OpenAPIHono<AppEnv>();

artifactPlacementRouter.use('*', validateActor);

await autoRegisterRoutes(artifactPlacementRouter, import.meta.dirname);
