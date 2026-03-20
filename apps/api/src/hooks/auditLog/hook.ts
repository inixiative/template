import type { HookOptions, ManyAction, SingleAction } from '@template/db';
import { DbAction, db, HookTiming, isAuditEnabled, Prisma, registerDbHook } from '@template/db';
import { AuditAction, type AuditSubjectModel } from '@template/db/generated/client/enums';
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

const isDeleteAction = (action: DbAction): action is DbAction.delete | DbAction.deleteMany =>
  action === DbAction.delete || action === DbAction.deleteMany;

const buildDeleteContextFkFields = (model: AuditSubjectModel, record: Record<string, unknown>) => {
  if (model === 'Organization') return {};
  if (model === 'Space') {
    return {
      contextOrganizationId: record.organizationId ?? null,
      contextSpaceId: null,
    };
  }
  return buildContextFkFields(model, record);
};

const buildAuditEntry = (
  model: AuditSubjectModel,
  action: AuditAction,
  record: Record<string, unknown>,
  previous?: Record<string, unknown>,
  withContextFkFields = true,
  withSubjectFkFields = true,
): Prisma.AuditLogCreateManyInput | null => {
  const actor = auditActorContext.getScope();

  const processedAfter = action !== AuditAction.delete ? processAuditData(model, record) : undefined;
  const processedBefore = previous ? processAuditData(model, previous) : undefined;
  const changes =
    action === AuditAction.update && processedBefore && processedAfter
      ? computeDiff(processedBefore, processedAfter)
      : undefined;

  if (action === AuditAction.update && changes && Object.keys(changes).length === 0) return null;

  return {
    action,
    subjectModel: model,
    before: (processedBefore as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    after: (processedAfter as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    changes: (changes as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    actorUserId: actor?.actorUserId ?? null,
    actorSpoofUserId: actor?.actorSpoofUserId ?? null,
    actorTokenId: actor?.actorTokenId ?? null,
    actorJobName: actor?.actorJobName ?? null,
    ipAddress: actor?.ipAddress ?? null,
    userAgent: actor?.userAgent ?? null,
    sourceInquiryId: actor?.sourceInquiryId ?? null,
    ...(withContextFkFields ? buildContextFkFields(model, record) : {}),
    ...(withSubjectFkFields ? buildSubjectFkFields(model, record) : {}),
  };
};

const buildEntries = (model: AuditSubjectModel, options: HookOptions) => {
  const { action: dbAction } = options;
  const entries: NonNullable<ReturnType<typeof buildAuditEntry>>[] = [];

  // Hard deletes: capture entity data in `before` JSON and always drop subject FKs.
  // Keep tenant context for child deletes, clear org context for Organization deletes,
  // and clear only the space context for Space deletes.
  if (isDeleteAction(dbAction)) {
    if (isManyAction(dbAction)) {
      const records = (options.result ?? []) as Record<string, unknown>[];
      for (const record of records) {
        const entry = buildAuditEntry(model, AuditAction.delete, record, record, false, false);
        if (entry) {
          Object.assign(entry, buildDeleteContextFkFields(model, record));
          entries.push(entry);
        }
      }
    } else {
      const record = (options as HookOptions & { action: SingleAction }).result as Record<string, unknown> | undefined;
      if (!record) return entries;
      const entry = buildAuditEntry(model, AuditAction.delete, record, record, false, false);
      if (entry) {
        Object.assign(entry, buildDeleteContextFkFields(model, record));
        entries.push(entry);
      }
    }
    return entries;
  }

  if (isManyAction(dbAction)) {
    const { result, previous } = options as HookOptions & { action: ManyAction };
    const results = (result ?? []) as (Record<string, unknown> & { id: string })[];
    const previouses = (previous ?? []) as Record<string, unknown>[];
    const previousById = new Map(previouses.map((p) => [p.id as string, p]));

    for (const record of results) {
      const prev = previousById.get(record.id);
      const entry = buildAuditEntry(model, dbActionToAuditAction(dbAction, record, prev), record, prev);
      if (entry) entries.push(entry);
    }

    return entries;
  }

  const { result, previous } = options as HookOptions & { action: SingleAction };
  const record = result as (Record<string, unknown> & { id: string }) | undefined;
  if (!record) return entries;

  const prev = previous as Record<string, unknown> | undefined;
  const entry = buildAuditEntry(model, dbActionToAuditAction(dbAction, record, prev), record, prev);
  if (entry) entries.push(entry);

  return entries;
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
    if (options.model === 'AuditLog') return;
    if (!isAuditEnabled(options.model)) return;

    const entries = buildEntries(options.model as AuditSubjectModel, options);
    if (entries.length === 0) return;

    await db.auditLog.createManyAndReturn({ data: entries });
  });
};
