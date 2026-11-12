/**
 * @atlas
 * @kind controller
 * @partOf feature:auditLogs, superadmin
 * @uses primitive:routeTemplates
 */
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { auditHistoryWhere } from '#/modules/admin/auditLog/queries/auditHistoryWhere';
import { auditLogReadManyRoute } from '#/modules/admin/auditLog/routes/auditLogReadMany';
import { includeAuditLogResponse } from '#/modules/admin/auditLog/schemas/auditLogResponseSchema';

export const auditLogReadManyController = makeController(
  auditLogReadManyRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { historyModel, historyId } = c.req.valid('query');

    const { data, pagination } = await paginate(c, db.auditLog, {
      ...(historyModel && historyId
        ? { where: auditHistoryWhere({ model: historyModel, id: historyId }) }
        : {}),
      include: includeAuditLogResponse,
      orderBy: { createdAt: 'desc' },
    });

    return respond.ok(data, { pagination });
  },
);
