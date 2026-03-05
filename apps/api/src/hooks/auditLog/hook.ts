import type { HookOptions, ManyAction, SingleAction } from '@template/db';
import { DbAction, db, HookTiming, registerDbHook } from '@template/db';
import { AuditAction, type AuditSubjectModel } from '@template/db/generated/client/enums';
import { auditActorContext } from '#/lib/auditActorContext';
import { isAuditEnabled } from '#/hooks/auditLog/constants/enabledModels';
import { buildSubjectFkFields, computeDiff, processAuditData } from '#/hooks/auditLog/utils';

const dbActionToAuditAction = (dbAction: DbAction, hasPrevious: boolean): AuditAction => {
  if (dbAction === DbAction.upsert) return hasPrevious ? AuditAction.update : AuditAction.create;
  if (dbAction === DbAction.createManyAndReturn) return AuditAction.create;
  if (dbAction === DbAction.updateManyAndReturn) return AuditAction.update;
  if (dbAction === DbAction.deleteMany) return AuditAction.delete;
  return dbAction as unknown as AuditAction;
};

const isManyAction = (action: DbAction): action is ManyAction =>
  action === DbAction.createManyAndReturn || action === DbAction.updateManyAndReturn || action === DbAction.deleteMany;

const buildAuditEntry = (
  model: AuditSubjectModel,
  action: AuditAction,
  record: Record<string, unknown>,
  previous?: Record<string, unknown>,
) => {
  const actor = auditActorContext.get();

  const processedAfter = action !== AuditAction.delete ? processAuditData(model, record) : undefined;
  const processedBefore = previous ? processAuditData(model, previous) : undefined;
  const changes =
    action === AuditAction.update && processedBefore && processedAfter
      ? computeDiff(model, previous!, record)
      : undefined;

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
    organizationId: (record.organizationId as string | null) ?? null,
    spaceId: (record.spaceId as string | null) ?? null,
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

    if (!isAuditEnabled(model)) return;

    const entries: ReturnType<typeof buildAuditEntry>[] = [];

    if (isManyAction(dbAction)) {
      const { result, previous } = options as HookOptions & { action: ManyAction };
      const results = (result ?? []) as (Record<string, unknown> & { id: string })[];
      const previouses = (previous ?? []) as Record<string, unknown>[];
      const previousById = new Map(previouses.map((p) => [p.id as string, p]));

      for (const record of results) {
        const prev = previousById.get(record.id);
        entries.push(buildAuditEntry(model as AuditSubjectModel, dbActionToAuditAction(dbAction, !!prev), record, prev));
      }
    } else {
      const { result, previous } = options as HookOptions & { action: SingleAction };
      const record = result as Record<string, unknown> & { id: string };
      const prev = previous as Record<string, unknown> | undefined;
      entries.push(buildAuditEntry(model as AuditSubjectModel, dbActionToAuditAction(dbAction, !!prev), record, prev));
    }

    if (entries.length === 0) return;

    db.onCommit(async () => {
      await db.auditLog.createMany({ data: entries as any });
    });
  });
};
