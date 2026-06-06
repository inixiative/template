import { OpenAPIHono } from '@hono/zod-openapi';
import { toOpenApi } from '#/lib/routeTemplates/utils';
import { auditLogReadManyController } from '#/modules/admin/auditLog/controllers/auditLogReadMany';
import { auditLogReadManyRoute } from '#/modules/admin/auditLog/routes/auditLogReadMany';
import type { AppEnv } from '#/types/appEnv';

export const adminAuditLogRouter = new OpenAPIHono<AppEnv>();

adminAuditLogRouter.openapi(toOpenApi(auditLogReadManyRoute), auditLogReadManyController);
