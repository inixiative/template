import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import type { AppEnv } from '#/types/appEnv';

export const featureFlagRouter = new OpenAPIHono<AppEnv>();

await autoRegisterRoutes(featureFlagRouter, import.meta.dirname);
