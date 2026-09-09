/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { db, Prisma } from '@template/db';
import { AuditAction, type AuditSubjectModel } from '@template/db/generated/client/enums';
import { auditActorContext } from '@template/db/lib/auditActorContext';
import { buildContextFkFields, buildSubjectFkFields, processAuditData } from '#/hooks/auditLog/utils';

export const createVersionBumpSnapshot = async (
  model: AuditSubjectModel,
  record: Record<string, unknown>,
  componentVersions: Record<string, string | null>,
): Promise<string> => {
  const actor = auditActorContext.getScope();
  const processed = processAuditData(model, record) as Prisma.InputJsonValue;

  const entry: Prisma.AuditLogCreateManyInput = {
    action: AuditAction.update,
    subjectModel: model,
    before: processed,
    after: processed,
    changes: Prisma.JsonNull,
    componentVersions: componentVersions as Prisma.InputJsonValue,
    actorUserId: actor?.actorUserId ?? null,
    actorSpoofUserId: actor?.actorSpoofUserId ?? null,
    actorTokenId: actor?.actorTokenId ?? null,
    actorJobName: actor?.actorJobName ?? null,
    ipAddress: actor?.ipAddress ?? null,
    userAgent: actor?.userAgent ?? null,
    sourceInquiryId: actor?.sourceInquiryId ?? null,
    integrationId: actor?.integrationId ?? null,
    ...buildContextFkFields(model, record),
    ...buildSubjectFkFields(model, record),
  };

  const [created] = await db.auditLog.createManyAndReturn({ data: [entry] });
  return created.id;
};
