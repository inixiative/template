/**
 * @atlas
 * @kind module
 * @partOf feature:billing
 */
import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterAdminRoutes, autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import type { AppEnv } from '#/types/appEnv';

export const billingResourceRouter = new OpenAPIHono<AppEnv>();

await autoRegisterRoutes(billingResourceRouter, import.meta.dirname);

export const adminBillingResourceRouter = new OpenAPIHono<AppEnv>();

await autoRegisterAdminRoutes(adminBillingResourceRouter, import.meta.dirname);
