/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { db, Prisma } from '@template/db';
import { AuditAction, type AuditSubjectModel } from '@template/db/generated/client/enums';
import { auditActorContext } from '@template/db/lib/auditActorContext';
import {
  auditActorColumns,
  buildContextFkFields,
  buildSubjectFkFields,
  maskSensitiveAndOmitNoopFieldsForAudit,
} from '#/hooks/auditLog/utils';

export const createVersionBumpSnapshot = async (
  model: AuditSubjectModel,
  record: Record<string, unknown>,
  componentVersions: Record<string, string | null>,
): Promise<string> => {
  const actor = auditActorContext.currentActor();
  const processed = maskSensitiveAndOmitNoopFieldsForAudit(model, record) as Prisma.InputJsonValue;

  const entry: Prisma.AuditLogCreateManyInput = {
    action: AuditAction.update,
    subjectModel: model,
    subjectId: typeof record.id === 'string' ? record.id : null,
    before: processed,
    after: processed,
    changes: Prisma.JsonNull,
    componentVersions: componentVersions as Prisma.InputJsonValue,
    ...auditActorColumns(actor),
    ...buildContextFkFields(model, record),
    ...buildSubjectFkFields(model, record),
  };

  const [created] = await db.auditLog.createManyAndReturn({ data: [entry] });
  return created.id;
};
