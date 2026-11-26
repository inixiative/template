import { DbAction, HookTiming, registerDbHook, SOFT_DELETE_MODEL_SET } from '@template/db';
import { auditActorContext } from '@template/db/lib/auditActorContext';

// Append-only history: models with no deletedAt column whose rows must never
// be hard-deleted either. Updates stay allowed (status transitions, snapshot
// augmentation); only row removal is refused.
const APPEND_ONLY_MODELS = new Set(['AuditLog']);

const isDeletePlannedByUserMerge = (model: string, action: string, args: unknown): boolean => {
  const merge = auditActorContext.currentUserMerge();
  if (!merge || action !== DbAction.delete) return false;
  const id = (args as { where?: { id?: unknown } } | null)?.where?.id;
  return typeof id === 'string' && merge.plannedDeletes.has(`${model}.${id}`);
};

export const registerPreventHardDeleteHook = () => {
  registerDbHook(
    'preventHardDelete',
    [...APPEND_ONLY_MODELS, ...SOFT_DELETE_MODEL_SET],
    HookTiming.before,
    [DbAction.delete, DbAction.deleteMany],
    async ({ model, action, args }) => {
      if (isDeletePlannedByUserMerge(model, action, args)) return;
      if (APPEND_ONLY_MODELS.has(model)) {
        throw new Error(`[preventHardDelete] ${model} is append-only history; refusing ${action}.`);
      }
      throw new Error(
        `[preventHardDelete] ${model} is soft-delete; refusing ${action}. ` +
          `Use update({ data: { deletedAt: new Date() } }) instead, or go through the redact service for GDPR purges.`,
      );
    },
  );
};
