import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import { validateActor } from '#/middleware/validations/validateActor';
import type { AppEnv } from '#/types/appEnv';

export const artifactPermissionRouter = new OpenAPIHono<AppEnv>();

artifactPermissionRouter.use('*', validateActor);

await autoRegisterRoutes(artifactPermissionRouter, import.meta.dirname);
