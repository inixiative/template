import type { HookOptions } from '@template/db';
import {
  AUDIT_ENABLED_MODELS,
  DbAction,
  db,
  HookTiming,
  Prisma,
  redactChangeDiff,
  redactSensitiveFields,
  registerDbHook,
} from '@template/db';
import { AuditAction, type AuditSubjectModel } from '@template/db/generated/client/enums';
import { auditActorContext, auditActorStore } from '@template/db/lib/auditActorContext';
import { castArray, keyBy } from 'lodash-es';
import { type ContextRow, contextRows } from '#/hooks/auditLog/contextRows';
import {
  auditActorColumns,
  buildContextFkFields,
  buildSubjectFkFields,
  computeDiff,
  filterForAudit,
} from '#/hooks/auditLog/utils';
import { isSoftDeleteTransition } from '#/hooks/shared/softDeleteTransition';

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

const isDeleteAction = (action: DbAction): action is DbAction.delete | DbAction.deleteMany =>
  action === DbAction.delete || action === DbAction.deleteMany;

const buildDeleteContextFkFields = (model: AuditSubjectModel, context: ContextRow) => {
  if (model === 'Organization') return {};
  if (model === 'Space') {
    return {
      contextOrganizationId: context.row.organizationId ?? null,
      contextSpaceId: null,
    };
  }
  return buildContextFkFields(context.model, context.row);
};

const buildAuditEntry = (
  model: AuditSubjectModel,
  action: AuditAction,
  record: Record<string, unknown>,
  previous: Record<string, unknown> | undefined,
  contextFkFields: Record<string, unknown>,
  withSubjectFkFields = true,
): Prisma.AuditLogCreateManyInput | null => {
  const actor = auditActorContext.getScope();

  // Filter noop fields, then diff on the UNREDACTED result so a change to a sensitive field is still
  // detected — redacting first would mask both sides to the same token and the change would vanish
  // under the empty-diff guard. Redact the stored snapshots and the changed values afterward.
  const filteredAfter = action !== AuditAction.delete ? filterForAudit(model, record) : undefined;
  const filteredBefore = previous ? filterForAudit(model, previous) : undefined;
  const changes =
    action === AuditAction.update && filteredBefore && filteredAfter
      ? computeDiff(filteredBefore, filteredAfter)
      : undefined;

  if (action === AuditAction.update && changes && Object.keys(changes).length === 0) return null;

  const processedAfter = filteredAfter ? redactSensitiveFields(model, filteredAfter) : undefined;
  const processedBefore = filteredBefore ? redactSensitiveFields(model, filteredBefore) : undefined;
  const processedChanges = changes ? redactChangeDiff(model, changes) : undefined;

  return {
    action,
    subjectModel: model,
    before: (processedBefore as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    after: (processedAfter as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    changes: (processedChanges as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    ...auditActorColumns(actor),
    ...contextFkFields,
    ...(withSubjectFkFields ? buildSubjectFkFields(model, record) : {}),
  };
};

const buildEntries = async (model: AuditSubjectModel, options: HookOptions) => {
  const { action: dbAction } = options;
  const entries: NonNullable<ReturnType<typeof buildAuditEntry>>[] = [];

  // Hard deletes: capture entity data in `before` JSON and always drop subject FKs.
  // Keep tenant context for child deletes, clear org context for Organization deletes,
  // and clear only the space context for Space deletes.
  if (isDeleteAction(dbAction)) {
    const records = castArray(options.result ?? []) as Record<string, unknown>[];
    const contexts = await contextRows(model, records);
    records.forEach((record, index) => {
      const entry = buildAuditEntry(
        model,
        AuditAction.delete,
        record,
        record,
        buildDeleteContextFkFields(model, contexts[index]!),
        false,
      );
      if (entry) entries.push(entry);
    });
    return entries;
  }

  const { result, previous } = options;
  const records = castArray(result ?? []) as (Record<string, unknown> & { id: string })[];
  const previousById = keyBy(castArray(previous ?? []) as Record<string, unknown>[], 'id');
  const contexts = await contextRows(model, records);

  records.forEach((record, index) => {
    const prev = previousById[record.id];
    const context = contexts[index]!;
    const entry = buildAuditEntry(
      model,
      dbActionToAuditAction(dbAction, record, prev),
      record,
      prev,
      buildContextFkFields(context.model, context.row),
    );
    if (entry) entries.push(entry);
  });

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

  registerDbHook(
    'auditLog',
    AUDIT_ENABLED_MODELS,
    HookTiming.after,
    actions,
    async (options: HookOptions) => {
      const entries = await buildEntries(options.model as AuditSubjectModel, options);
      if (entries.length === 0) return;

      await db.auditLog.createManyAndReturn({ data: entries });
    },
    [auditActorStore],
  );
};
