import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import { validateActor } from '#/middleware/validations/validateActor';
import type { AppEnv } from '#/types/appEnv';

export const artifactContainerRouter = new OpenAPIHono<AppEnv>();

artifactContainerRouter.use('*', validateActor);

await autoRegisterRoutes(artifactContainerRouter, import.meta.dirname);
