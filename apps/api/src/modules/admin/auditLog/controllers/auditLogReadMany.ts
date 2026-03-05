import { makeController } from '#/lib/utils/makeController';
import { auditLogReadManyRoute } from '#/modules/admin/auditLog/routes/auditLogReadMany';

export const auditLogReadManyController = makeController(auditLogReadManyRoute, async (c, respond) => {
  const db = c.get('db');

  const auditLogs = await db.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return respond.ok(auditLogs);
});
