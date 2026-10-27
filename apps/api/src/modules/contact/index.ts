import { OpenAPIHono } from '@hono/zod-openapi';
import { toOpenApi } from '#/lib/routeTemplates/utils';
import { autoRegisterAdminRoutes, autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import { contactInfoController } from '#/modules/contact/controllers/contactInfo';
import { contactInfoRoute } from '#/modules/contact/routes/contactInfo';
import type { AppEnv } from '#/types/appEnv';

export const contactRouter = new OpenAPIHono<AppEnv>();

contactRouter.openapi(toOpenApi(contactInfoRoute), contactInfoController);

await autoRegisterRoutes(contactRouter, import.meta.dirname);

export const adminContactRouter = new OpenAPIHono<AppEnv>();

await autoRegisterAdminRoutes(adminContactRouter, import.meta.dirname);
