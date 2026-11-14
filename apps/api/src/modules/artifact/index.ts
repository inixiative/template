import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import type { AppEnv } from '#/types/appEnv';

export const artifactRouter = new OpenAPIHono<AppEnv>();

await autoRegisterRoutes(artifactRouter, import.meta.dirname);
