import { AuditLogModelSchema } from '@template/db/zod/models';
import { readRoute } from '#/lib/routeTemplates/read';
import { Modules } from '#/modules/modules';

export const auditLogReadManyRoute = readRoute({
  model: Modules.auditLog,
  many: true,
  admin: true,
  responseSchema: AuditLogModelSchema,
});
