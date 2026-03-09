import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { auditLogReadManyRoute } from '#/modules/admin/auditLog/routes/auditLogReadMany';
import { includeAuditLogResponse } from '#/modules/admin/auditLog/schemas/auditLogResponseSchema';

export const auditLogReadManyController = makeController(auditLogReadManyRoute, async (c, respond) => {
  const db = c.get('db');

  const { data, pagination } = await paginate(c, db.auditLog, {
    include: includeAuditLogResponse,
    orderBy: { createdAt: 'desc' },
  });

  return respond.ok(data, { pagination });
});
