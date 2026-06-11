/**
 * @atlas
 * @kind route
 * @partOf feature:auditLogs, superadmin
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates/read';
import { auditLogResponseSchema } from '#/modules/admin/auditLog/schemas/auditLogResponseSchema';
import { Modules } from '#/modules/modules';

export const auditLogReadManyRoute = readRoute({
  model: Modules.auditLog,
  many: true,
  paginate: true,
  admin: true,
  filterLens: { parent: lensFor('AuditLog') },
  responseSchema: auditLogResponseSchema,
});
