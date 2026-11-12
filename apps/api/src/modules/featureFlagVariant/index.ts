import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import type { AppEnv } from '#/types/appEnv';

export const featureFlagVariantRouter = new OpenAPIHono<AppEnv>();

await autoRegisterRoutes(featureFlagVariantRouter, import.meta.dirname);
