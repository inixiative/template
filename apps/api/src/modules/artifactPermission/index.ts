import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import type { AppEnv } from '#/types/appEnv';

export const artifactPermissionRouter = new OpenAPIHono<AppEnv>();

await autoRegisterRoutes(artifactPermissionRouter, import.meta.dirname);
