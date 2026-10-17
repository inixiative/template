import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import { validateActor } from '#/middleware/validations/validateActor';
import type { AppEnv } from '#/types/appEnv';

export const artifactRouter = new OpenAPIHono<AppEnv>();

artifactRouter.use('*', validateActor);

await autoRegisterRoutes(artifactRouter, import.meta.dirname);
