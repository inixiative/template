/**
 * @atlas
 * @kind route
 * @partOf feature:auditLogs, superadmin
 * @uses primitive:routeTemplates
 */
import { z } from '@hono/zod-openapi';
import { AuditSubjectModel } from '@template/db/generated/client/enums';
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates/read';
import { auditLogResponseSchema } from '#/modules/admin/auditLog/schemas/auditLogResponseSchema';
import { Modules } from '#/modules/modules';

export const auditLogReadManyRoute = readRoute({
  model: Modules.auditLog,
  many: true,
  paginate: true,
  admin: true,
  query: z.object({
    historyModel: z.nativeEnum(AuditSubjectModel).optional(),
    historyId: z.string().optional(),
  }),
  queryRefinement: (
    { historyModel, historyId }: { historyModel?: AuditSubjectModel; historyId?: string },
    ctx: z.RefinementCtx,
  ) => {
    if ((historyModel === undefined) !== (historyId === undefined))
      ctx.addIssue({
        code: 'custom',
        path: [historyModel === undefined ? 'historyModel' : 'historyId'],
        message: 'historyModel and historyId go together',
      });
  },
  filterLens: { parent: lensFor('AuditLog') },
  responseSchema: auditLogResponseSchema,
});
