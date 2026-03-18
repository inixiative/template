import type { HookOptions, ManyAction, Prisma, SingleAction } from '@template/db';
import { DbAction, db, HookTiming, registerDbHook } from '@template/db';
import { AuditAction, type AuditSubjectModel } from '@template/db/generated/client/enums';
import { isAuditEnabled } from '@template/db';
import { buildContextFkFields, buildSubjectFkFields, computeDiff, processAuditData } from '#/hooks/auditLog/utils';
import { auditActorContext } from '#/lib/auditActorContext';

const isSoftDeleteTransition = (previous?: Record<string, unknown>, record?: Record<string, unknown>): boolean =>
  previous?.deletedAt == null && record?.deletedAt != null;

const dbActionToAuditAction = (
  dbAction: DbAction,
  record: Record<string, unknown>,
  previous?: Record<string, unknown>,
): AuditAction => {
  if (dbAction === DbAction.upsert) {
    if (!previous) return AuditAction.create;
    return isSoftDeleteTransition(previous, record) ? AuditAction.delete : AuditAction.update;
  }
  if (dbAction === DbAction.createManyAndReturn) return AuditAction.create;
  if (dbAction === DbAction.update || dbAction === DbAction.updateManyAndReturn) {
    return isSoftDeleteTransition(previous, record) ? AuditAction.delete : AuditAction.update;
  }
  if (dbAction === DbAction.create) return AuditAction.create;
  if (dbAction === DbAction.deleteMany) return AuditAction.delete;
  return AuditAction.delete;
};

const isManyAction = (action: DbAction): action is ManyAction =>
  action === DbAction.createManyAndReturn || action === DbAction.updateManyAndReturn || action === DbAction.deleteMany;

const buildAuditEntry = (
  model: AuditSubjectModel,
  action: AuditAction,
  record: Record<string, unknown>,
  previous?: Record<string, unknown>,
): Prisma.AuditLogCreateManyInput | null => {
  const actor = auditActorContext.get();

  const processedAfter = action !== AuditAction.delete ? processAuditData(model, record) : undefined;
  const processedBefore = previous ? processAuditData(model, previous) : undefined;
  const changes =
    action === AuditAction.update && processedBefore && processedAfter
      ? computeDiff(model, previous!, record)
      : undefined;

  if (action === AuditAction.update && changes && Object.keys(changes).length === 0) return null;

  return {
    action,
    subjectModel: model,
    before: processedBefore ?? null,
    after: processedAfter ?? null,
    changes: changes ?? null,
    actorUserId: actor?.actorUserId ?? null,
    actorSpoofUserId: actor?.actorSpoofUserId ?? null,
    actorTokenId: actor?.actorTokenId ?? null,
    ipAddress: actor?.ipAddress ?? null,
    userAgent: actor?.userAgent ?? null,
    sourceInquiryId: actor?.sourceInquiryId ?? null,
    ...buildContextFkFields(model, record),
    ...buildSubjectFkFields(model, record),
  };
};

export const registerAuditLogHook = () => {
  const actions = [
    DbAction.create,
    DbAction.update,
    DbAction.delete,
    DbAction.upsert,
    DbAction.createManyAndReturn,
    DbAction.updateManyAndReturn,
    DbAction.deleteMany,
  ];

  registerDbHook('auditLog', '*', HookTiming.after, actions, async (options: HookOptions) => {
    const { model, action: dbAction } = options;

    if (model === 'AuditLog') return;
    if (!isAuditEnabled(model)) return;

    const entries: NonNullable<ReturnType<typeof buildAuditEntry>>[] = [];

    if (isManyAction(dbAction)) {
      const { result, previous } = options as HookOptions & { action: ManyAction };
      const results = (result ?? []) as (Record<string, unknown> & { id: string })[];
      const previouses = (previous ?? []) as Record<string, unknown>[];
      const previousById = new Map(previouses.map((p) => [p.id as string, p]));

      for (const record of results) {
        const prev = previousById.get(record.id);
        const entry = buildAuditEntry(
          model as AuditSubjectModel,
          dbActionToAuditAction(dbAction, record, prev),
          record,
          prev,
        );
        if (entry) entries.push(entry);
      }
    } else {
      const { result, previous } = options as HookOptions & { action: SingleAction };
      const record = result as Record<string, unknown> & { id: string };
      const prev = previous as Record<string, unknown> | undefined;
      const entry = buildAuditEntry(
        model as AuditSubjectModel,
        dbActionToAuditAction(dbAction, record, prev),
        record,
        prev,
      );
      if (entry) entries.push(entry);
    }

    if (entries.length === 0) return;

    await db.auditLog.createMany({ data: entries });
  });
};
