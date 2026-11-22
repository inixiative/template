/**
 * @atlas
 * @kind module
 * @partOf feature:setting
 */
import { OpenAPIHono } from '@hono/zod-openapi';
import { toOpenApi } from '#/lib/routeTemplates/utils';
import { autoRegisterAdminRoutes, autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import { settingInfoController } from '#/modules/setting/controllers/settingInfo';
import { settingInfoRoute } from '#/modules/setting/routes/settingInfo';
import type { AppEnv } from '#/types/appEnv';

export const settingRouter = new OpenAPIHono<AppEnv>();

settingRouter.openapi(toOpenApi(settingInfoRoute), settingInfoController);

await autoRegisterRoutes(settingRouter, import.meta.dirname);

export const adminSettingRouter = new OpenAPIHono<AppEnv>();

await autoRegisterAdminRoutes(adminSettingRouter, import.meta.dirname);
