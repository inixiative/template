import { OpenAPIHono } from '@hono/zod-openapi';
import { autoRegisterAdminRoutes, autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import type { AppEnv } from '#/types/appEnv';

export const inquiryRouter = new OpenAPIHono<AppEnv>();

await autoRegisterRoutes(inquiryRouter, import.meta.dirname);

export const adminInquiryRouter = new OpenAPIHono<AppEnv>();

await autoRegisterAdminRoutes(adminInquiryRouter, import.meta.dirname);
