/**
 * @atlas
 * @kind module
 * @partOf feature:billing
 */
import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterAdminRoutes, autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import type { AppEnv } from '#/types/appEnv';

export const billingAccountRouter = new OpenAPIHono<AppEnv>();

await autoRegisterRoutes(billingAccountRouter, import.meta.dirname);

export const adminBillingAccountRouter = new OpenAPIHono<AppEnv>();

await autoRegisterAdminRoutes(adminBillingAccountRouter, import.meta.dirname);
