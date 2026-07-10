import { DbAction, HookTiming, registerDbHook, SOFT_DELETE_MODEL_SET } from '@template/db';

// Append-only history: models with no deletedAt column whose rows must never
// be hard-deleted either. Updates stay allowed (status transitions, snapshot
// augmentation); only row removal is refused.
const APPEND_ONLY_MODELS = new Set(['AuditLog']);

export const registerPreventHardDeleteHook = () => {
  registerDbHook(
    'preventHardDelete',
    '*',
    HookTiming.before,
    [DbAction.delete, DbAction.deleteMany],
    async ({ model, action }) => {
      if (APPEND_ONLY_MODELS.has(model)) {
        throw new Error(`[preventHardDelete] ${model} is append-only history; refusing ${action}.`);
      }
      if (!SOFT_DELETE_MODEL_SET.has(model)) return;
      throw new Error(
        `[preventHardDelete] ${model} is soft-delete; refusing ${action}. ` +
          `Use update({ data: { deletedAt: new Date() } }) instead, or go through the redact service for GDPR purges.`,
      );
    },
  );
};
