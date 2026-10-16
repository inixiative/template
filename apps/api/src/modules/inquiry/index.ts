import { OpenAPIHono } from '@hono/zod-openapi';
import { toOpenApi } from '#/lib/routeTemplates/utils';
import { autoRegisterAdminRoutes, autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import { validateActor } from '#/middleware/validations/validateActor';
import { inquiryInfoController } from '#/modules/inquiry/controllers/inquiryInfo';
import { inquiryInfoRoute } from '#/modules/inquiry/routes/inquiryInfo';
import type { AppEnv } from '#/types/appEnv';

export const inquiryRouter = new OpenAPIHono<AppEnv>();

inquiryRouter.openapi(toOpenApi(inquiryInfoRoute), inquiryInfoController);

inquiryRouter.use('*', validateActor);

await autoRegisterRoutes(inquiryRouter, import.meta.dirname);

export const adminInquiryRouter = new OpenAPIHono<AppEnv>();

await autoRegisterAdminRoutes(adminInquiryRouter, import.meta.dirname);
